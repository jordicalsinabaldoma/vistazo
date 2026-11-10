"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { api, fmtDate } from "@/lib/client";

type Rev = {
  id: string;
  number: number;
  title: string;
  source: string;
  createdAt: number;
  publishedBy: string;
  approvals: string[];
  flows: number;
  captures: number;
  open: number;
  total: number;
};
type Check = { id?: string; title: string; description?: string; flowKey?: string };
type Data = {
  project: { id: string; name: string; context: string; checklist: Check[] };
  members: { id: string; name: string; email: string; role: string }[];
  revisions: Rev[];
  me: { role: string; can: Record<string, boolean> };
};

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<"revs" | "setup" | "access">("revs");
  const [err, setErr] = useState("");
  const load = useCallback(
    () =>
      api<Data>(`/api/projects/${id}`)
        .then(setD)
        .catch((e) => (e.status === 401 ? (location.href = "/") : setErr(e.message))),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (err) return <p className="p-10 text-bad">{err}</p>;
  if (!d) return <p className="p-10 text-muted">Cargando…</p>;

  return (
    <>
      <TopBar>
        <Link href="/app" className="hover:underline">
          Proyectos
        </Link>{" "}
        / <span className="text-ink">{d.project.name}</span>
      </TopBar>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{d.project.name}</h1>
          {d.me.can.publish && (
            <Link href={`/p/${id}/nueva`} className="btn btn-accent">
              + Publicar revisión
            </Link>
          )}
        </div>
        <nav className="mt-6 flex gap-1 border-b border-line text-sm">
          {(
            [
              ["revs", "Revisiones"],
              ["setup", "Contexto y checklist"],
              ...(d.me.can.manage ? [["access", "Acceso y agente"]] : []),
            ] as [typeof tab, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-3 py-2 font-medium ${tab === k ? "border-ink" : "border-transparent text-muted"}`}
            >
              {l}
            </button>
          ))}
        </nav>
        {tab === "revs" && <Revisions revs={d.revisions} />}
        {tab === "setup" && <Setup d={d} reload={load} />}
        {tab === "access" && <Access d={d} reload={load} />}
      </main>
    </>
  );
}

function Revisions({ revs }: { revs: Rev[] }) {
  if (!revs.length)
    return (
      <p className="mt-8 text-muted">
        Aún no hay revisiones. Publica una desde el formulario o desde tu agente (pestaña «Acceso y agente»).
      </p>
    );
  return (
    <ul className="mt-6 grid gap-3">
      {revs.map((r) => (
        <li key={r.id}>
          <Link href={`/r/${r.id}`} className="card flex flex-wrap items-center gap-4 p-4 transition hover:border-ink/40">
            <span className="font-mono text-lg font-semibold">v{r.number}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-xs text-muted">
                {fmtDate(r.createdAt)} · {r.publishedBy} · {r.source === "agent" ? "desde agente" : "desde formulario"} ·{" "}
                {r.flows} recorridos · {r.captures} adjuntos
              </p>
            </div>
            {r.open > 0 && <span className="chip bg-warnbg text-warn">{r.open} pendientes</span>}
            {r.approvals.length > 0 ? (
              <span className="chip bg-okbg text-ok">✓ Aprobada · {r.approvals.join(", ")}</span>
            ) : (
              <span className="chip bg-paper text-muted">En revisión</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Setup({ d, reload }: { d: Data; reload: () => void }) {
  const [context, setContext] = useState(d.project.context);
  const [items, setItems] = useState<Check[]>(d.project.checklist);
  const [saved, setSaved] = useState("");
  const can = d.me.can.publish;
  async function save() {
    await api(`/api/projects/${d.project.id}`, { method: "PATCH", json: { context, checklist: items } });
    setSaved("Guardado");
    reload();
    setTimeout(() => setSaved(""), 2000);
  }
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <section className="card p-5">
        <h2 className="font-semibold">Contexto del proyecto</h2>
        <p className="mt-1 text-sm text-muted">
          Lo ve cada revisor y entra en el prompt para el agente. Qué es la app, para quién, qué no tocar.
        </p>
        <textarea
          className="input mt-3 font-mono text-xs"
          rows={12}
          value={context}
          disabled={!can}
          onChange={(e) => setContext(e.target.value)}
        />
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Checklist de flujos críticos</h2>
        <p className="mt-1 text-sm text-muted">
          Lo que hay que probar en <b>cada</b> revisión. Cada equipo define los suyos; Vistazo recuerda qué falta.
        </p>
        <ul className="mt-3 grid gap-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <input
                className="input"
                value={it.title}
                disabled={!can}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
              <input
                className="input w-36 font-mono text-xs"
                placeholder="recorrido"
                value={it.flowKey ?? ""}
                disabled={!can}
                onChange={(e) =>
                  setItems(items.map((x, j) => (j === i ? { ...x, flowKey: e.target.value || undefined } : x)))
                }
              />
              {can && (
                <button className="btn btn-ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {can && (
          <button className="btn mt-3" onClick={() => setItems([...items, { title: "" }])}>
            + Añadir flujo crítico
          </button>
        )}
      </section>
      {can && (
        <div className="flex items-center gap-3 md:col-span-2">
          <button className="btn btn-primary" onClick={save}>
            Guardar
          </button>
          <span className="text-sm text-ok">{saved}</span>
        </div>
      )}
    </div>
  );
}

type Link_ = { id: string; label: string; revoked: boolean; createdAt: number; expiresAt?: number };
type Key = { id: string; label: string; prefix: string; revoked: boolean; createdAt: number };

function Access({ d, reload }: { d: Data; reload: () => void }) {
  const pid = d.project.id;
  const [links, setLinks] = useState<Link_[]>([]);
  const [keys, setKeys] = useState<Key[]>([]);
  const [secret, setSecret] = useState<{ kind: string; value: string } | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    setLinks((await api(`/api/projects/${pid}/links`)).links);
    setKeys((await api(`/api/projects/${pid}/keys`)).keys);
  }, [pid]);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (fn: () => Promise<unknown>) => {
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="mt-6 grid gap-6">
      {msg && <p className="rounded-md bg-badbg px-3 py-2 text-sm text-bad">{msg}</p>}
      {secret && (
        <div className="card border-accent p-4">
          <p className="text-sm font-medium">
            {secret.kind === "link" ? "Enlace de invitado" : "Clave de agente"} — cópiala ahora, no se vuelve a mostrar:
          </p>
          <code data-testid="secret" className="mt-2 block break-all rounded bg-paper p-2 text-xs">
            {secret.value}
          </code>
          <button className="btn mt-2" onClick={() => navigator.clipboard.writeText(secret.value)}>
            Copiar
          </button>
        </div>
      )}

      <section className="card p-5">
        <h2 className="font-semibold">Miembros identificados</h2>
        <p className="text-sm text-muted">Solo ellos pueden aprobar. Editor: publica y resuelve. Revisor: comenta y aprueba.</p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {d.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <span className="flex-1">
                {m.name} <span className="text-muted">· {m.email}</span>
              </span>
              <span className="chip bg-paper">{m.role}</span>
              {m.role !== "owner" && (
                <button
                  className="btn btn-ghost text-bad"
                  onClick={() => run(async () => (await api(`/api/projects/${pid}/members?userId=${m.id}`, { method: "DELETE" }), reload()))}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            const form = e.currentTarget;
            run(async () => {
              await api(`/api/projects/${pid}/members`, { method: "POST", json: f });
              form.reset();
              reload();
            });
          }}
        >
          <input name="email" type="email" required placeholder="correo de su cuenta" className="input max-w-xs" />
          <select name="role" className="input w-auto">
            <option value="reviewer">Revisor</option>
            <option value="editor">Editor</option>
          </select>
          <button className="btn">Añadir</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Enlaces de invitado</h2>
        <p className="text-sm text-muted">
          Quien tenga el enlace puede ver, probar y comentar en <b>este</b> proyecto, sin cuenta. No puede aprobar.
          Revocar corta el acceso al instante, también a capturas y vídeos.
        </p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <span className="flex-1">
                {l.label} <span className="text-muted">· {fmtDate(l.createdAt)}</span>
                {l.expiresAt && <span className="text-muted"> · caduca {fmtDate(l.expiresAt)}</span>}
              </span>
              {l.revoked ? (
                <span className="chip bg-badbg text-bad">Revocado</span>
              ) : (
                <button
                  className="btn btn-ghost text-bad"
                  onClick={() => run(async () => (await api(`/api/projects/${pid}/links/${l.id}`, { method: "DELETE" }), load()))}
                >
                  Revocar
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(async () => {
              const r = await api(`/api/projects/${pid}/links`, {
                method: "POST",
                json: { label: f.get("label"), days: f.get("days") ? Number(f.get("days")) : undefined },
              });
              setSecret({ kind: "link", value: r.url });
              load();
            });
          }}
        >
          <input name="label" required placeholder="p. ej. Diseñadora externa" className="input max-w-xs" />
          <select name="days" className="input w-auto" defaultValue="14">
            <option value="7">7 días</option>
            <option value="14">14 días</option>
            <option value="30">30 días</option>
            <option value="">Sin caducidad</option>
          </select>
          <button className="btn">Crear enlace</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Claves de agente (CLI / MCP)</h2>
        <p className="text-sm text-muted">
          Limitadas a este proyecto: publicar revisiones y leer el feedback. No comentan, no resuelven, no aprueban.
        </p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-2">
              <span className="flex-1">
                {k.label} <code className="text-xs text-muted">{k.prefix}…</code>
              </span>
              {k.revoked ? (
                <span className="chip bg-badbg text-bad">Revocada</span>
              ) : (
                <button
                  className="btn btn-ghost text-bad"
                  onClick={() => run(async () => (await api(`/api/projects/${pid}/keys/${k.id}`, { method: "DELETE" }), load()))}
                >
                  Revocar
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const label = new FormData(e.currentTarget).get("label");
            run(async () => {
              const r = await api(`/api/projects/${pid}/keys`, { method: "POST", json: { label } });
              setSecret({ kind: "key", value: r.key });
              load();
            });
          }}
        >
          <input name="label" required placeholder="p. ej. Claude Code portátil" className="input max-w-xs" />
          <button className="btn">Crear clave</button>
        </form>
        <pre className="mt-4 overflow-x-auto rounded-md bg-ink p-3 text-xs text-white/90">{`export VISTAZO_URL=${typeof location !== "undefined" ? location.origin : ""}
export VISTAZO_PROJECT=${pid}
export VISTAZO_API_KEY=vzk_…   # nunca en el repo
npx vistazo publish --config vistazo.config.json --capture
npx vistazo feedback latest`}</pre>
      </section>
    </div>
  );
}
