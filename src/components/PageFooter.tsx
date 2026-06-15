export function PageFooter() {
  return (
    <footer className="mt-auto w-full">
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(to right, transparent, #C9BCB4 40%, #C9BCB4 60%, transparent)",
          opacity: 0.25,
        }}
      />
      {/* Mobile: só o centro */}
      <div className="flex items-center justify-center px-6 py-3 sm:hidden">
        <span className="text-xs font-light tracking-widest" style={{ color: "#C9BCB4" }}>
          ✦ 2026 ✦
        </span>
      </div>
      {/* sm+: três colunas */}
      <div className="hidden items-center justify-between px-6 py-3 sm:flex">
        <span className="text-xs tracking-wide" style={{ color: "#C9BCB4" }}>
          angry box · detroit style
        </span>
        <span className="text-xs font-light tracking-widest" style={{ color: "#C9BCB4" }}>
          ✦ 2026 ✦
        </span>
        <span className="text-xs tracking-wide" style={{ color: "#C9BCB4" }}>
          authentic · focaccia-like pizza
        </span>
      </div>
    </footer>
  );
}
