import { forwardRef, useEffect, useRef, useState } from "react";

/**
 * Parses a decimal string that may use comma or period as decimal separator,
 * including common European formats like "1.234,56" or "1,234.56".
 */
function parseDecimal(s: string): number | null {
  const str = s.trim();
  if (!str || str === "-") return null;

  const commas = (str.match(/,/g) ?? []).length;
  const periods = (str.match(/\./g) ?? []).length;

  let normalized: string;

  if (commas > 1) {
    // "1.234,56" → commas are thousand separators, remove them
    normalized = str.replace(/,/g, "");
  } else if (periods > 1) {
    // "1.234.567" → periods are thousand separators, remove them
    normalized = str.replace(/\./g, "");
  } else if (commas === 1 && periods === 1) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      // "1.234,56" → period=thousand, comma=decimal
      normalized = str.replace(/\./g, "").replace(",", ".");
    } else {
      // "1,234.56" → comma=thousand, period=decimal
      normalized = str.replace(/,/g, "");
    }
  } else if (commas === 1) {
    // "1000,50" → comma is decimal separator (PT locale)
    normalized = str.replace(",", ".");
  } else {
    normalized = str;
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

export interface NumericInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "onChange" | "value"
  > {
  /** Current value. Accepts numbers or decimal strings (using . or ,). */
  value?: number | string | null;
  /**
   * Change handler compatible with the standard `e.target.value` pattern.
   * The emitted value is always normalized (comma → period), so callers
   * can safely use `parseFloat(e.target.value)`.
   */
  onChange?: (e: { target: { value: string } }) => void;
  /** Number of decimal places to format on blur. Default: 2. */
  decimals?: number;
}

/**
 * Drop-in replacement for `<input type="number">` for decimal/monetary values.
 *
 * Improvements over native number inputs:
 * - Accepts comma (,) as decimal separator (PT locale)
 * - Selects all text on focus so you can immediately type a new value
 * - Prevents accidental scroll-wheel changes
 * - Formats to the correct number of decimal places on blur
 * - No native spinners (▲▼ arrows)
 */
export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, onFocus, onBlur, decimals = 2, ...rest }, ref) => {
    function formatForDisplay(v: number | string | null | undefined): string {
      if (v === null || v === undefined || v === "") return "";
      const num = typeof v === "number" ? v : parseDecimal(String(v));
      if (num === null) return "";
      return num.toFixed(decimals);
    }

    const [display, setDisplay] = useState(() => formatForDisplay(value));
    const focused = useRef(false);

    useEffect(() => {
      if (!focused.current) {
        setDisplay(formatForDisplay(value));
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, decimals]);

    function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
      focused.current = true;
      e.target.select();
      onFocus?.(e);
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      focused.current = false;
      const num = parseDecimal(display);
      setDisplay(num !== null ? num.toFixed(decimals) : "");
      onBlur?.(e);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      setDisplay(raw);
      // Normalize comma → period so callers using parseFloat(e.target.value) work correctly
      onChange?.({ target: { value: raw.replace(",", ".") } });
    }

    function handleWheel(e: React.WheelEvent<HTMLInputElement>) {
      if (document.activeElement === e.currentTarget) e.currentTarget.blur();
    }

    return (
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onWheel={handleWheel}
      />
    );
  }
);
NumericInput.displayName = "NumericInput";
