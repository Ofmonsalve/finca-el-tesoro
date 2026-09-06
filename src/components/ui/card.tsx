import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 md:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "font-display text-xl font-medium tracking-tight text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function CardHint({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("mt-1 text-sm leading-relaxed text-muted", className)} {...props} />
  );
}
