import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"entrar" | "crear">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "crear") {
        const { error } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim(),
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message);
      }
      await authClient.getSession();
      await nav({ to: "/" });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "No se pudo entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-sm space-y-6">
        <header>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Finca El Tesoro
          </p>
          <h1 className="font-display text-4xl tracking-tight">Entrar</h1>
          <p className="mt-2 text-sm text-muted">
            El libro de cosecha queda atado a su cuenta. Un dispositivo, o
            varios: el mismo kilo no se mezcla con el de otro usuario.
          </p>
        </header>

        {!authEnabled ? (
          <p className="text-sm text-muted">El acceso está desactivado.</p>
        ) : (
          <>
            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continuar con {p.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-subtle">
              <span className="h-px flex-1 bg-border" />
              o correo
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onEmail} className="space-y-3">
              {mode === "crear" ? (
                <Field label="Nombre">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </Field>
              ) : null}
              <Field label="Correo">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Contraseña">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "crear" ? "new-password" : "current-password"
                  }
                  minLength={8}
                  required
                />
              </Field>
              {err ? <p className="text-sm text-danger">{err}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? "Un momento…"
                  : mode === "crear"
                    ? "Crear cuenta"
                    : "Entrar"}
              </Button>
            </form>

            <button
              type="button"
              className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
              onClick={() => {
                setMode(mode === "crear" ? "entrar" : "crear");
                setErr(null);
              }}
            >
              {mode === "crear"
                ? "Ya tengo cuenta"
                : "Crear cuenta con correo"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
