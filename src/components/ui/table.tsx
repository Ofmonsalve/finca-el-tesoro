import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table
        className={cn("w-full min-w-[640px] text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "bg-elevated/80 px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-subtle first:rounded-tl-xl last:rounded-tr-xl",
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
        "border-t border-border/70 px-3 py-3 text-fg",
        className,
      )}
      {...props}
    />
  );
}
