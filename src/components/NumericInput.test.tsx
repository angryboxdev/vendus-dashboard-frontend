import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NumericInput } from "./NumericInput.tsx";

describe("NumericInput", () => {
  describe("display formatting", () => {
    it("formats a number to 2 decimal places by default", () => {
      render(<NumericInput value={1234.5} />);
      expect(screen.getByRole("textbox")).toHaveValue("1234.50");
    });

    it("respects decimals={0}", () => {
      render(<NumericInput value={7} decimals={0} />);
      expect(screen.getByRole("textbox")).toHaveValue("7");
    });

    it("respects decimals={3}", () => {
      render(<NumericInput value={1.5} decimals={3} />);
      expect(screen.getByRole("textbox")).toHaveValue("1.500");
    });

    it("renders empty for null", () => {
      render(<NumericInput value={null} />);
      expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("renders empty for undefined", () => {
      render(<NumericInput />);
      expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("renders empty for empty string", () => {
      render(<NumericInput value="" />);
      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  describe("onChange normalization", () => {
    it("emits period instead of comma as decimal separator", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<NumericInput onChange={onChange} />);
      await user.type(screen.getByRole("textbox"), "1234,56");
      const lastEmitted = onChange.mock.calls.at(-1)?.[0].target.value;
      expect(lastEmitted).toBe("1234.56");
    });

    it("passes through values with a period unchanged", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<NumericInput onChange={onChange} />);
      await user.type(screen.getByRole("textbox"), "99.5");
      const lastEmitted = onChange.mock.calls.at(-1)?.[0].target.value;
      expect(lastEmitted).toBe("99.5");
    });
  });

  describe("blur formatting", () => {
    it("formats to 2 decimal places on blur", async () => {
      const user = userEvent.setup();
      render(<NumericInput decimals={2} />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "42");
      await user.tab();
      expect(input).toHaveValue("42.00");
    });

    it("formats to 0 decimal places on blur when decimals={0}", async () => {
      const user = userEvent.setup();
      render(<NumericInput decimals={0} />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "15");
      await user.tab();
      expect(input).toHaveValue("15");
    });

    it("formats to 3 decimal places on blur when decimals={3}", async () => {
      const user = userEvent.setup();
      render(<NumericInput decimals={3} />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "1.5");
      await user.tab();
      expect(input).toHaveValue("1.500");
    });

    it("parses comma as decimal separator on blur (PT locale: 1234,56)", async () => {
      const user = userEvent.setup();
      render(<NumericInput decimals={2} />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "1234,56");
      await user.tab();
      expect(input).toHaveValue("1234.56");
    });

    it("parses European thousand+decimal format on blur (1.234,56)", async () => {
      const user = userEvent.setup();
      render(<NumericInput decimals={2} />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "1.234,56");
      await user.tab();
      expect(input).toHaveValue("1234.56");
    });

    it("parses US thousand+decimal format on blur (1,234.56)", async () => {
      const user = userEvent.setup();
      render(<NumericInput decimals={2} />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "1,234.56");
      await user.tab();
      expect(input).toHaveValue("1234.56");
    });

    it("clears display for non-numeric input on blur", async () => {
      const user = userEvent.setup();
      render(<NumericInput />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "abc");
      await user.tab();
      expect(input).toHaveValue("");
    });

    it("clears display for lone dash on blur", async () => {
      const user = userEvent.setup();
      render(<NumericInput />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "-");
      await user.tab();
      expect(input).toHaveValue("");
    });
  });

  describe("external value updates", () => {
    it("updates display when value prop changes while not focused", () => {
      const { rerender } = render(<NumericInput value={10} decimals={2} />);
      expect(screen.getByRole("textbox")).toHaveValue("10.00");
      rerender(<NumericInput value={20} decimals={2} />);
      expect(screen.getByRole("textbox")).toHaveValue("20.00");
    });

    it("does not override display when value prop changes while focused", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<NumericInput value={10} decimals={2} />);
      const input = screen.getByRole("textbox");
      await user.click(input);
      rerender(<NumericInput value={99} decimals={2} />);
      expect(input).toHaveValue("10.00");
    });
  });
});
