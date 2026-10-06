function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const SIZE_CLASSES: Record<"sm" | "lg", string> = {
  sm: "h-8 w-8 text-xs",
  lg: "h-20 w-20 text-2xl",
};

export function Avatar({
  name,
  photoUrl,
  size = "sm",
}: {
  name: string;
  photoUrl: string | null;
  size?: "sm" | "lg";
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`shrink-0 rounded-full object-cover shadow-sm ${SIZE_CLASSES[size]}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ED5C32] to-[#EF8935] font-bold text-white shadow-sm ${SIZE_CLASSES[size]}`}
    >
      {initials(name) || "?"}
    </div>
  );
}
