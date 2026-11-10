"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/TopBar";
import { api } from "@/lib/client";

export default function Home() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);

  useEffect(() => {
    api("/api/me").then((m) => setLogged(m.user?.name ?? null)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: f });
      location.href = "/app";
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-4 py-10 md:grid-cols-[1.3fr_1fr] md:py-20">
      <section>
        <Logo />
        <h1 className="mt-10 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          La pull request
          <br />
          <span className="text-accent">visual</span> de tu app.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Publica una versión con su contexto y sus recorridos de prueba, comparte un enlace, deja que la prueben y
          comenten sobre lo que ven, y recoge una aprobación explícita. El feedback vuelve a tu agente de código como un
          resumen y un prompt que tú revisas.
        </p>
        <ol className="mt-10 grid max-w-xl gap-3 text-sm">
          {[
            ["Publica", "desde tu agente (CLI/MCP) o con un formulario: enlace, capturas, vídeos, recorridos."],
            ["Comparte", "con miembros identificados o con un enlace de invitado revocable, por proyecto."],
            ["Revisa", "comentarios anclados a capturas, pasos o la web en vivo. Checklist de flujos críticos."],
            ["Cierra el círculo", "resumen + prompt para tu agente; la siguiente versión arrastra lo pendiente."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              <span>
                <b>{t}</b> <span className="text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="self-start">
        {logged ? (
          <div className="card p-6">
            <p className="text-sm text-muted">Sesión iniciada como</p>
            <p className="mt-1 text-lg font-semibold">{logged}</p>
            <a href="/app" className="btn btn-primary mt-6 w-full">
              Ir a mis proyectos
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6">
            <div className="mb-6 flex gap-1 rounded-lg bg-paper p-1 text-sm">
              {(["login", "signup"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md py-1.5 font-medium ${mode === m ? "bg-card shadow-sm" : "text-muted"}`}
                >
                  {m === "login" ? "Entrar" : "Crear cuenta"}
                </button>
              ))}
            </div>
            {mode === "signup" && (
              <div className="mb-4">
                <label className="label" htmlFor="name">
                  Nombre
                </label>
                <input id="name" name="name" className="input" required autoComplete="name" />
              </div>
            )}
            <div className="mb-4">
              <label className="label" htmlFor="email">
                Correo
              </label>
              <input id="email" name="email" type="email" className="input" required autoComplete="email" />
            </div>
            <div className="mb-6">
              <label className="label" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            {err && <p className="mb-4 rounded-md bg-badbg px-3 py-2 text-sm text-bad">{err}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
            <p className="mt-4 text-xs text-muted">
              ¿Te han pasado un enlace de revisión? Ábrelo directamente: no necesitas cuenta para ver, probar y comentar.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
