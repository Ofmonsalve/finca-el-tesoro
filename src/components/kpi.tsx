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
        "rounded-xl border border-border bg-surface px-4 py-4",
        className,
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-subtle">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-medium tracking-tight tabular text-fg">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
