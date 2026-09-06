/** Parse es-CO numbers and COP strings: $ 1.200 → 1200 */
export function n(x: unknown): number {
  if (x == null || x === "") return 0;
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  let s = String(x).trim();
  if (!s || s === "—" || s === "-") return 0;
  s = s.replace(/[$\s\u00a0]/g, "").replace(/COP/gi, "");
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d+\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const v = parseFloat(s);
  if (Number.isNaN(v)) return 0;
  return neg ? -v : v;
}

export function fmtNum(v: number, d = 0) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("es-CO", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function fmtMoney(v: number) {
  if (v == null || Number.isNaN(v)) return "—";
  const neg = v < 0;
  const s =
    "$ " +
    Math.round(Math.abs(v)).toLocaleString("es-CO", {
      maximumFractionDigits: 0,
    });
  return neg ? `(${s})` : s;
}

export function fmtDate(s?: string) {
  if (!s) return "—";
  const p = String(s).slice(0, 10).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(s);
}

export function todayISO() {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function fmtKg(v: number) {
  return `${fmtNum(v, 1)} kg`;
}

export function fmtRatio(f: number) {
  if (!f || Number.isNaN(f)) return "—";
  return `${fmtNum(f, 2)} : 1`;
}

export function fmtPct(v: number, d = 1) {
  if (Number.isNaN(v)) return "—";
  return `${fmtNum(v, d)} %`;
}
