import * as React from "react";
import { fmtMoney, fmtNum, n } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export function MoneyInput({
  value,
  onValue,
  className,
}: {
  value: string;
  onValue: (raw: string) => void;
  className?: string;
}) {
  const [focus, setFocus] = React.useState(false);
  const shown = focus ? value : value === "" ? "" : fmtMoney(n(value));
  return (
    <Input
      className={cn("text-right font-mono", className)}
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        if (value !== "") onValue(String(Math.round(n(value))));
      }}
      onChange={(e) => onValue(e.target.value)}
      placeholder="$ 0"
    />
  );
}

export function DecimalInput({
  value,
  onValue,
  decimals = 1,
  className,
  placeholder,
}: {
  value: string;
  onValue: (raw: string) => void;
  decimals?: number;
  className?: string;
  placeholder?: string;
}) {
  const [focus, setFocus] = React.useState(false);
  const shown =
    focus || value === "" ? value : fmtNum(n(value), decimals);
  return (
    <Input
      className={cn("text-right font-mono", className)}
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        if (value !== "") onValue(String(n(value)));
      }}
      onChange={(e) => onValue(e.target.value)}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-lg border border-border bg-elevated px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
