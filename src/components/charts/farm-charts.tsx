import type { CSSProperties } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTheme } from "./theme";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/format";

const tipStyle: CSSProperties = {
  background: chartTheme.tooltip.background,
  border: `1px solid ${chartTheme.tooltip.border}`,
  borderRadius: 14,
  color: chartTheme.tooltip.color,
  fontSize: 12,
  padding: "10px 12px",
  boxShadow: "0 12px 40px rgba(0,0,0,.35)",
};

export function KgAreaChart({
  data,
}: {
  data: { fecha: string; kg: number; cost: number }[];
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="kgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartTheme.accent} stopOpacity={0.42} />
            <stop offset="100%" stopColor={chartTheme.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
        <XAxis
          dataKey="fecha"
          tickFormatter={(v) => fmtDate(String(v)).slice(0, 5)}
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmtNum(Number(v), 0)}
          width={48}
        />
        <Tooltip
          contentStyle={tipStyle}
          labelFormatter={(l) => fmtDate(String(l))}
          formatter={(v: number, name) => [
            name === "kg" ? `${fmtNum(v, 1)} kg` : fmtMoney(v),
            name === "kg" ? "Cereza" : "Costo",
          ]}
        />
        <Area
          type="monotone"
          dataKey="kg"
          stroke={chartTheme.accent}
          fill="url(#kgFill)"
          strokeWidth={2.4}
          activeDot={{ r: 5, fill: chartTheme.fg, stroke: chartTheme.accent }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LotBarChart({
  data,
}: {
  data: { lote: string; kg: number }[];
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
        <XAxis
          dataKey="lote"
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={tipStyle}
          formatter={(v: number) => [`${fmtNum(v, 1)} kg`, "Cereza"]}
        />
        <Bar dataKey="kg" radius={[8, 8, 0, 0]} maxBarSize={42}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={i % 2 === 0 ? chartTheme.accent : chartTheme.accentSoft}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CostDonut({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const colors = [
    chartTheme.accent,
    chartTheme.warn,
    chartTheme.ok,
    chartTheme.muted,
  ];
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={74}
          outerRadius={102}
          paddingAngle={4}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tipStyle} formatter={(v: number) => fmtMoney(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StageBars({
  data,
}: {
  data: { name: string; n: number }[];
}) {
  if (!data.some((d) => d.n)) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid stroke={chartTheme.grid} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={118}
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v}`, "Lotes"]} />
        <Bar dataKey="n" fill={chartTheme.accent} radius={[0, 8, 8, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ConversionChart({
  data,
}: {
  data: { name: string; kg: number; expected?: number }[];
}) {
  if (!data.length || !data.some((d) => d.kg)) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid stroke={chartTheme.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmtNum(Number(v), 0)}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={128}
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tipStyle}
          formatter={(v: number, name) => [
            `${fmtNum(v, 1)} kg`,
            name === "expected" ? "Esperado" : "Medido",
          ]}
        />
        <Bar
          dataKey="expected"
          fill={chartTheme.muted}
          radius={[0, 6, 6, 0]}
          maxBarSize={8}
        />
        <Bar
          dataKey="kg"
          fill={chartTheme.accent}
          radius={[0, 8, 8, 0]}
          maxBarSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted">
      Sin datos aún. Registre la primera sesión de cosecha.
    </div>
  );
}
