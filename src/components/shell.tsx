import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  Home,
  BarChart3,
  Leaf,
  LayoutDashboard,
  Menu,
  Tractor,
  Users,
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
import { canExport, canRestore, roleLabel } from "@/lib/roles";
import { areaActiva } from "@/lib/lots";
import { setActivePersistFarmId } from "@/lib/farm-book-init";
import { useFarmRegistry, displayFarmName } from "@/lib/farm-registry";
import { useFarm } from "@/lib/store";
import { Button } from "./ui/button";

/**
 * Locked nav (Omar / AuraCoffee) — generational leap:
 * Primary: Pulso · Territorios · Cosecha · Talento · Inteligencia
 * Finca: Pulso · Lotes · Cosecha · Talento · Inteligencia
 * Lote: Cosecha · Labores · Nutrición · Cultivo
 * Never: Casa, Dueño, Oficina, Panel, Más, Desempeño, Panorama, Fincas, Gente, Analítica, Equipo, Resumen (as nav).
 */
const AURA_NAV = [
  { to: "/", label: "Pulso", icon: Home },
  { to: "/", label: "Territorios", icon: LayoutDashboard, hash: "fincas" },
  { to: "/cosecha", label: "Cosecha", icon: Leaf },
  { to: "/talento", label: "Talento", icon: Users },
  { to: "/finanzas", label: "Inteligencia", icon: BarChart3 },
] as const;

const FINCA_NAV = [
  { to: "/estado", label: "Pulso", icon: Home },
  { to: "/lotes", label: "Lotes", icon: Tractor },
  { to: "/cosecha", label: "Cosecha", icon: Leaf },
  { to: "/talento", label: "Talento", icon: Users },
  { to: "/finanzas", label: "Inteligencia", icon: BarChart3 },
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
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, 800);
    void (async () => {
      try {
        await Promise.resolve(useFarmRegistry.persist.rehydrate());
        if (cancelled) return;
        useFarmRegistry.getState().setHydrated(true);
        const active = useFarmRegistry.getState().activeFarmId;
        setActivePersistFarmId(active);
        await Promise.resolve(useFarm.persist.rehydrate());
        if (cancelled) return;
        // Align in-memory farmId with registry if blob was empty/legacy.
        const book = useFarm.getState();
        if (book.farmId !== active) {
          // Do not flush the default empty book over another farm's blob.
          useFarm.getState().switchFarm(active, { flush: false });
        }
        setHydrated(true);
      } catch {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
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

  const atHoy = pathname === "/";
  const levelLabel = atHoy ? "Pulso" : "Finca";
  const navItems = atHoy ? AURA_NAV : FINCA_NAV;

  function NavList(
    items: readonly {
      to: string;
      label: string;
      icon: typeof Home;
      hash?: string;
    }[],
  ) {
    return items.map((item) => {
      const hash = "hash" in item ? item.hash : undefined;
      // Holding Pulso="/"; Finca Pulso="/estado"; Territorios = scroll target on "/".
      const isActive =
        item.label === "Pulso" && item.to === "/"
          ? pathname === "/"
          : item.label === "Pulso" && item.to === "/estado"
            ? pathname === "/estado"
            : item.label === "Territorios"
              ? false
              : pathname === item.to || pathname.startsWith(`${item.to}/`);
      const Icon = item.icon;
      return (
        <Link
          key={`${item.label}-${item.to}-${hash ?? ""}`}
          to={item.to}
          {...(hash ? { hash } : {})}
          onClick={() => setOpen(false)}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
            isActive
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
            Pulso · Territorios
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
            <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-subtle">
              {levelLabel}
            </div>
            {NavList(navItems)}
            {!atHoy ? (
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="mt-3 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-accent hover:bg-elevated/60"
              >
                <Home className="size-4 shrink-0" />
                Volver a Pulso
              </Link>
            ) : null}
          </nav>
          <div className="space-y-2 border-t border-border p-3">
            <p className="px-1 text-[11px] leading-relaxed text-muted">
              Pulso → Finca → Lote. Cada cifra lleva el nombre de su finca. El rol define quién registra y quién solo mira.
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
  const switchFarm = useFarm((s) => s.switchFarm);
  const farms = useFarmRegistry((s) => s.farms);
  const activeFarmId = useFarmRegistry((s) => s.activeFarmId);
  const createFarm = useFarmRegistry((s) => s.createFarm);
  const renameFarm = useFarmRegistry((s) => s.renameFarm);
  const setActiveFarmId = useFarmRegistry((s) => s.setActiveFarmId);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "create" | "rename">("list");
  const [draftName, setDraftName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const name = displayFarmName(farmId, farms);

  function resetPanel() {
    setMode("list");
    setDraftName("");
    setNote(null);
  }

  function onSwitch(id: string) {
    if (id === activeFarmId && id === farmId) {
      setOpen(false);
      resetPanel();
      return;
    }
    const reg = setActiveFarmId(id);
    if (!reg.ok) {
      setNote(reg.error ?? "No se pudo cambiar.");
      return;
    }
    const r = switchFarm(id);
    if (!r.ok) {
      setNote(r.error ?? "No se pudo abrir esa finca.");
      return;
    }
    setOpen(false);
    resetPanel();
  }

  function onCreate() {
    const r = createFarm(draftName);
    if (!r.ok || !r.farm) {
      setNote(r.error ?? "No se pudo crear.");
      return;
    }
    const sw = switchFarm(r.farm.id);
    if (!sw.ok) {
      setNote(sw.error ?? "Finca creada, pero no se abrió.");
      return;
    }
    setOpen(false);
    resetPanel();
  }

  function onRename() {
    const r = renameFarm(activeFarmId, draftName);
    if (!r.ok) {
      setNote(r.error ?? "No se pudo renombrar.");
      return;
    }
    setMode("list");
    setDraftName("");
    setNote("Nombre actualizado.");
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (v) resetPanel();
            return !v;
          });
        }}
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
          {mode === "list" ? (
            <>
              <ul className="max-h-56 overflow-y-auto py-1">
                {farms.map((f) => {
                  const active = f.id === activeFarmId;
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => onSwitch(f.id)}
                        className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-surface/80"
                      >
                        <span className="text-fg">{f.name}</span>
                        {active ? (
                          <span className="text-[11px] uppercase tracking-wide text-accent">
                            Activa
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">Abrir</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-1 border-t border-border p-2">
                <button
                  type="button"
                  className="min-h-10 rounded-md px-2 text-left text-sm text-accent hover:bg-surface/80"
                  onClick={() => {
                    setMode("create");
                    setDraftName("");
                    setNote(null);
                  }}
                >
                  Nueva finca…
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-md px-2 text-left text-sm text-muted hover:bg-surface/80"
                  onClick={() => {
                    setMode("rename");
                    setDraftName(name);
                    setNote(null);
                  }}
                >
                  Renombrar «{name}»
                </button>
              </div>
              <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted">
                Cada finca tiene sus propios lotes. Al cambiar, se guarda esta y
                se abre la otra.
              </p>
            </>
          ) : null}
          {mode === "create" || mode === "rename" ? (
            <div className="space-y-2 p-3">
              <p className="text-xs text-muted">
                {mode === "create"
                  ? "Nombre de la finca nueva (arranca sin lotes)."
                  : "Nuevo nombre para la finca activa."}
              </p>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Ej. La Esperanza"
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-accent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (mode === "create") onCreate();
                    else onRename();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => (mode === "create" ? onCreate() : onRename())}
                >
                  {mode === "create" ? "Crear" : "Guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMode("list");
                    setDraftName("");
                    setNote(null);
                  }}
                >
                  Atrás
                </Button>
              </div>
            </div>
          ) : null}
          {note ? (
            <p className="border-t border-border px-3 py-2 text-xs text-accent">
              {note}
            </p>
          ) : null}
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

