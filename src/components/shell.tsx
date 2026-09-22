import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  ChevronsUpDown,
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
import { useBookSyncStatus } from "@/lib/book-sync-status";
import { ClaimAdminButton } from "@/components/claim-admin";
import { FarmAccessProvider, useFarmAccess } from "@/components/farm-access";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { todayISO } from "@/lib/format";
import { canExport, canRestore, roleLabel, FARM_ID } from "@/lib/roles";
import { areaActiva } from "@/lib/lots";
import { useFarm } from "@/lib/store";
import { Button } from "./ui/button";

const PRIMARY = [
  { to: "/lotes", label: "Lotes", icon: Tractor },
  { to: "/cosecha", label: "Cosecha", icon: Leaf },
  { to: "/beneficio", label: "Grano", icon: Factory },
  { to: "/", label: "Panel", icon: LayoutDashboard },
] as const;

/** Secondary farm tools — Settings-style, not an “office”. */
const MORE = [
  { to: "/historial", label: "Historial", icon: BookOpen },
  { to: "/liquidacion", label: "Gente · pagos", icon: Users },
  { to: "/equipo", label: "Gente · roles", icon: Users },
  { to: "/productividad", label: "Productividad", icon: BarChart3 },
  { to: "/costos", label: "Costos", icon: Wallet },
  { to: "/ventas", label: "Ventas", icon: Scale },
  { to: "/finanzas", label: "Dinero", icon: Landmark },
  { to: "/contabilidad", label: "Libro", icon: BookOpen },
] as const;

function farmDisplayName(farmId: string): string {
  if (farmId === FARM_ID || farmId === "finca-el-tesoro") return "El Tesoro";
  return farmId.replace(/^finca-/, "").replace(/-/g, " ") || "Finca";
}

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

  return (
    <FarmAccessProvider>
      <ShellApp
        pathname={pathname}
        open={open}
        setOpen={setOpen}
        fileRef={fileRef}
        note={note}
        setNote={setNote}
        exportBook={exportBook}
        importBook={importBook}
      >
        {children}
      </ShellApp>
    </FarmAccessProvider>
  );
}

function ShellApp({
  children,
  pathname,
  open,
  setOpen,
  fileRef,
  note,
  setNote,
  exportBook,
  importBook,
}: {
  children: React.ReactNode;
  pathname: string;
  open: boolean;
  setOpen: (v: boolean | ((x: boolean) => boolean)) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  note: string | null;
  setNote: (v: string | null) => void;
  exportBook: () => Record<string, unknown>;
  importBook: (data: unknown) => { ok: boolean; error?: string };
}) {
  const { role, ready } = useFarmAccess();
  const lots = useFarm((s) => s.lots);
  const ha = areaActiva(lots);

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
          <div className="font-display text-lg">AURA</div>
          <div className="text-[11px] uppercase tracking-widest text-subtle">
            Lotes de la finca
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

      <div className="md:grid md:grid-cols-[260px_1fr]">
        <aside
          className={cn(
            "border-border bg-surface md:sticky md:top-0 md:h-dvh md:overflow-y-auto md:border-r no-print",
            open ? "block" : "hidden md:block",
          )}
        >
          <div className="hidden px-5 py-6 md:block">
            <FarmChip ha={ha} ready={ready} role={role} />
          </div>
          <nav className="flex flex-col gap-0.5 p-3">
            {NavList(PRIMARY)}
            <div className="mt-4 px-3 pb-1 text-[10px] uppercase tracking-widest text-subtle">
              Más
            </div>
            {NavList(MORE)}
          </nav>
          <div className="space-y-2 border-t border-border p-3">
            <p className="px-1 text-[11px] leading-relaxed text-muted">
              Primero la finca, luego el lote. El rol define quién registra y quién solo mira.
            </p>
            <div className="px-1">
              <UserButton />
            </div>
            <ClaimAdminButton className="px-1" />
            {canExport(role) ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadBook}>
                <Download className="size-3.5" /> JSON
              </Button>
              {canRestore(role) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-3.5" /> Restaurar
              </Button>
              ) : null}
            </div>
            ) : null}
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
        <main className="min-w-0 px-5 py-7 md:px-10 md:py-10">
          {!ready ? (
            <p className="text-sm text-muted">Abriendo el libro…</p>
          ) : (
            <>
              <BookSync />
              <BookSyncBanner />
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
}


function FarmChip({
  ha,
  ready,
  role,
}: {
  ha: number;
  ready: boolean;
  role: ReturnType<typeof useFarmAccess>["role"];
}) {
  const farmId = useFarm((s) => s.farmId);
  const [open, setOpen] = useState(false);
  const name = farmDisplayName(farmId);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl text-left transition-colors hover:bg-elevated/50"
        aria-expanded={open}
        aria-label="Cambiar finca"
      >
        <div className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Finca
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="font-display text-2xl tracking-tight">{name}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-subtle" />
        </div>
        <p className="mt-1 text-xs text-muted">
          {ha.toFixed(2).replace(".", ",")} ha activas
        </p>
        {ready ? (
          <p className="mt-2 text-[11px] uppercase tracking-widest text-accent">
            {roleLabel(role)}
          </p>
        ) : null}
      </button>
      {open ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-elevated">
          <div className="flex min-h-11 items-center justify-between px-3 text-sm">
            <span className="text-fg">{name}</span>
            <span className="text-[11px] uppercase tracking-wide text-accent">
              Activa
            </span>
          </div>
          <p className="border-t border-border px-3 py-3 text-xs leading-relaxed text-muted">
            Cambiar finca: cada finca tiene sus propios lotes. Pronto podrá
            elegir otra aquí; hoy esta sesión trabaja solo en {name}.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function BookSyncBanner() {
  const status = useBookSyncStatus((s) => s.status);
  const detail = useBookSyncStatus((s) => s.detail);
  if (status !== "conflict" && status !== "error") return null;
  return (
    <div
      role="status"
      className={cn(
        "mb-4 rounded-md border px-3 py-2 text-sm no-print",
        status === "conflict"
          ? "border-amber-600/40 bg-amber-500/10 text-amber-100"
          : "border-red-600/40 bg-red-500/10 text-red-100",
      )}
    >
      <p className="font-medium">
        {status === "conflict" ? "Sincronización en conflicto" : "Error de sincronización"}
      </p>
      {detail ? <p className="mt-1 text-xs opacity-90">{detail}</p> : null}
    </div>
  );
}

