import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface px-5 py-5",
        className,
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div className="mt-2 font-display text-[1.85rem] font-medium tracking-tight tabular text-fg">
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</div> : null}
    </div>
  );
}
