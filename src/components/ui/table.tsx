import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table
        className={cn("w-full min-w-[720px] border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "bg-elevated px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle first:rounded-tl-xl last:rounded-tr-xl",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "border-t border-border/80 px-5 py-4 align-middle leading-relaxed text-fg",
        className,
      )}
      {...props}
    />
  );
}
