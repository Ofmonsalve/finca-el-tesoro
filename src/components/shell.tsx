import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Factory,
  Landmark,
  LayoutDashboard,
  Leaf,
  Menu,
  Scale,
  Tractor,
  Users,
  Wallet,
  X,
  Download,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { BookSync } from "@/components/book-sync";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { todayISO } from "@/lib/format";
import { useFarm } from "@/lib/store";
import { Button } from "./ui/button";

const PRIMARY = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/cosecha", label: "Cosecha", icon: Leaf },
  { to: "/beneficio", label: "Beneficio", icon: Factory },
  { to: "/historial", label: "Historial", icon: BookOpen },
  { to: "/liquidacion", label: "Pagos", icon: Users },
] as const;

const MORE = [
  { to: "/productividad", label: "Productividad", icon: BarChart3 },
  { to: "/costos", label: "Costos", icon: Wallet },
  { to: "/lotes", label: "Lotes", icon: Tractor },
  { to: "/ventas", label: "Ventas", icon: Scale },
  { to: "/finanzas", label: "Finanzas", icon: Landmark },
  { to: "/contabilidad", label: "Libro", icon: BookOpen },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const setHydrated = useFarm((s) => s.setHydrated);
  const exportBook = useFarm((s) => s.exportBook);
  const importBook = useFarm((s) => s.importBook);
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    const p = useFarm.persist.rehydrate();
    void Promise.resolve(p).then(() => setHydrated(true));
    const t = window.setTimeout(() => setHydrated(true), 400);
    return () => window.clearTimeout(t);
  }, [setHydrated]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-muted">
        <p className="text-sm">Abriendo sesión…</p>
      </div>
    );
  }

  if (!user) {
    return <RedirectToSignIn />;
  }

  function downloadBook() {
    const blob = new Blob([JSON.stringify(exportBook(), null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `FT_libro_${todayISO()}.json`;
    a.click();
    setNote("Libro descargado en este dispositivo.");
  }

  function onImport(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const r = importBook(data);
        setNote(r.ok ? "Libro restaurado." : r.error ?? "No se pudo importar.");
      } catch {
        setNote("El archivo no es JSON válido.");
      }
    };
    reader.readAsText(f);
  }

  function NavList(
    items: readonly { to: string; label: string; icon: typeof Leaf }[],
  ) {
    return items.map((item) => {
      const active =
        item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
      const Icon = item.icon;
      return (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setOpen(false)}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
            active
              ? "bg-elevated text-fg"
              : "text-muted hover:bg-elevated/60 hover:text-fg",
          )}
        >
          <Icon className="size-4 shrink-0" />
          {item.label}
        </Link>
      );
    });
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:hidden no-print">
        <div>
          <div className="font-display text-lg">El Tesoro</div>
          <div className="text-[11px] uppercase tracking-widest text-subtle">
            Santander · 1.900 m
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Menú"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
      </header>

      <div className="md:grid md:grid-cols-[240px_1fr]">
        <aside
          className={cn(
            "border-border bg-surface md:sticky md:top-0 md:h-dvh md:overflow-y-auto md:border-r no-print",
            open ? "block" : "hidden md:block",
          )}
        >
          <div className="hidden px-5 py-6 md:block">
            <div className="text-[11px] uppercase tracking-[0.2em] text-accent">
              Finca
            </div>
            <div className="font-display text-2xl tracking-tight">El Tesoro</div>
            <p className="mt-1 text-xs text-muted">
              Caturra / Castillo · 0,87 ha
            </p>
          </div>
          <nav className="flex flex-col gap-0.5 p-3">
            {NavList(PRIMARY)}
            <div className="mt-4 px-3 pb-1 text-[10px] uppercase tracking-widest text-subtle">
              Análisis
            </div>
            {NavList(MORE)}
          </nav>
          <div className="space-y-2 border-t border-border p-3">
            <p className="px-1 text-[11px] leading-relaxed text-muted">
              Libro en su cuenta. JSON es el respaldo del día en el lote.
            </p>
            <div className="px-1">
              <UserButton />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadBook}>
                <Download className="size-3.5" /> JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-3.5" /> Restaurar
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
            {note ? <p className="text-xs text-accent">{note}</p> : null}
          </div>
        </aside>
        <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">
          <BookSync />
          {children}
        </main>
      </div>
    </div>
  );
}
