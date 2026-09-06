import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function hoursBetween(hi: string, hf: string) {
  if (!hi || !hf) return 0;
  const [ah, am] = hi.split(":").map(Number);
  const [bh, bm] = hf.split(":").map(Number);
  let h = bh + bm / 60 - (ah + am / 60);
  if (h < 0) h += 24;
  return Math.round(h * 100) / 100;
}
