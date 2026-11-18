"use client";
import { ChatCircle, GitBranch, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TopBar, { Crumb } from "@/components/TopBar";
import { CopyButton, ErrorNote, PrLink, StateLabel, plural } from "@/components/ui";
import { api, fmtDate } from "@/lib/client";
import type { ReviewSummary } from "@/lib/revisions";

type Check = { id?: string; title: string; description?: string; flowKey?: string };
type Data = {
  project: { id: string; name: string; context: string; checklist: Check[] };
  members: { id: string; name: string; email: string; role: string }[];
  reviews: ReviewSummary[];
  me: { id?: string; role: string; can: Record<string, boolean> };
};

const ROLE: Record<string, string> = { owner: "Propietario", editor: "Editor", reviewer: "Revisor" };

export default function AppPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<"reviews" | "settings">(() => (typeof location !== "undefined" && location.hash === "#ajustes" ? "settings" : "reviews"));
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

  if (err)
    return (
      <>
        <TopBar />
        <main className="mx-auto max-w-md px-4 py-16">
          <ErrorNote>{err}</ErrorNote>
        </main>
      </>
    );

  return (
    <>
      <TopBar>
        <Crumb>{d?.project.name ?? "…"}</Crumb>
      </TopBar>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {!d ? (
          <div className="h-40 animate-pulse rounded-xl bg-sunken" />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-3xl font-semibold tracking-tight">{d.project.name}</h1>
              {d.me.can.publish && (
                <Link href={`/p/${id}/nueva`} className="btn btn-primary">
                  <Plus size={16} weight="bold" aria-hidden /> Nueva revisión
                </Link>
              )}
            </div>
            <div className="segmented mt-6" role="tablist" aria-label="Secciones de la app">
              {(
                [
                  ["reviews", "Revisiones"],
                  ["settings", "Ajustes"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => {
                    setTab(k);
                    history.replaceState(null, "", k === "settings" ? "#ajustes" : location.pathname);
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            {tab === "reviews" ? <Reviews d={d} /> : <Settings d={d} reload={load} />}
          </>
        )}
      </main>
    </>
  );
}

function Reviews({ d }: { d: Data }) {
  const [show, setShow] = useState<"open" | "closed">("open");
  const [mine, setMine] = useState(false);
  const counts = { open: d.reviews.filter((r) => r.status === "open").length, closed: d.reviews.filter((r) => r.status === "closed").length };
  const myTurn = (r: ReviewSummary) =>
    r.author.id === d.me.id ? ["changes", "feedback", "approved"].includes(r.stage) : r.stage !== "closed" && !r.submittedBy.includes(d.me.id ?? "");
  const list = d.reviews.filter((r) => r.status === show && (!mine || myTurn(r)));

  return (
    <section className="mt-6" aria-label="Revisiones">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-xl border border-b-0 border-line bg-sunken/60 px-4 py-2.5 text-sm">
        {(["open", "closed"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setShow(k)}
            aria-pressed={show === k}
            className={`font-medium ${show === k ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {k === "open" ? "Abiertas" : "Cerradas"} <span className="tabular">{counts[k]}</span>
          </button>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-muted">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          Solo las que me tocan
        </label>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-b-xl border border-line bg-card">
        {list.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted">
            {d.reviews.length === 0
              ? "Aún no hay revisiones. Publica una desde tu agente (vistazo publish) o con «Nueva revisión»."
              : mine
                ? "Nada te toca aquí ahora mismo."
                : show === "open"
                  ? "No hay revisiones abiertas."
                  : "No hay revisiones cerradas."}
          </li>
        )}
        {list.map((r) => (
          <li key={r.id} className="relative flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-sunken/50 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <StateLabel stage={r.stage} label={r.stageLabel} />
                <Link href={`/r/${r.latestRevisionId}`} className="font-medium after:absolute after:inset-0 hover:underline">
                  {r.title}
                </Link>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                <span className="tabular">
                  #{r.number}, v{r.version}
                </span>
                <span>
                  {r.author.name}, {fmtDate(r.updatedAt)}
                </span>
                {r.branch && (
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <GitBranch size={13} aria-hidden />
                    {r.branch}
                  </span>
                )}
                {r.prUrl && (
                  <span className="relative z-10">
                    <PrLink url={r.prUrl} />
                  </span>
                )}
              </p>
            </div>
            {r.open > 0 && (
              <span className="inline-flex items-center gap-1 text-sm text-muted" title="Comentarios abiertos">
                <ChatCircle size={16} aria-hidden />
                <span className="tabular">{r.open}</span>
                <span className="sr-only">comentarios abiertos</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Ajustes: todo lo que no es revisar, en segundo plano ----------

type Link_ = { id: string; label: string; revoked: boolean; active: boolean; createdAt: number; expiresAt?: number; review: { number: number; title: string } | null };
type Key = { id: string; label: string; prefix: string; revoked: boolean; createdAt: number };

function Settings({ d, reload }: { d: Data; reload: () => void }) {
  const pid = d.project.id;
  const can = d.me.can.publish;
  const [context, setContext] = useState(d.project.context);
  const [items, setItems] = useState<Check[]>(d.project.checklist);
  const [saved, setSaved] = useState("");
  const [links, setLinks] = useState<Link_[]>([]);
  const [keys, setKeys] = useState<Key[]>([]);
  const [secret, setSecret] = useState("");
  const [msg, setMsg] = useState("");
  const [showRevoked, setShowRevoked] = useState(false);

  const loadAccess = useCallback(
    () =>
      Promise.all([
        d.me.can.publish ? api(`/api/projects/${pid}/links`).then((r) => setLinks(r.links)) : null,
        d.me.can.manage ? api(`/api/projects/${pid}/keys`).then((r) => setKeys(r.keys)) : null,
      ]).catch((e) => setMsg(e.message)),
    [pid, d.me.can.publish, d.me.can.manage],
  );
  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const run = async (fn: () => Promise<unknown>) => {
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  async function save() {
    await run(async () => {
      await api(`/api/projects/${pid}`, { method: "PATCH", json: { context, checklist: items.filter((i) => i.title.trim()) } });
      setSaved("Guardado");
      reload();
      setTimeout(() => setSaved(""), 2000);
    });
  }
  const active = (l: Link_) => l.active;
  const visibleLinks = links.filter((l) => showRevoked || active(l));
  const visibleKeys = keys.filter((k) => showRevoked || !k.revoked);
  const hidden = links.length - links.filter(active).length + keys.filter((k) => k.revoked).length;

  return (
    <div className="mt-6 grid gap-6 [&>*]:min-w-0">
      <ErrorNote>{msg}</ErrorNote>
      <section className="card p-5" aria-labelledby="s-about">
        <h2 id="s-about" className="section-title">
          Sobre la app
        </h2>
        <p className="hint">Lo ve cada revisor y entra en el prompt para tu agente. Qué es, para quién, qué no hay que tocar.</p>
        <textarea className="input mt-3" rows={6} value={context} disabled={!can} onChange={(e) => setContext(e.target.value)} aria-labelledby="s-about" />

        <h2 className="section-title mt-8">Flujos críticos</h2>
        <p className="hint">Lo que hay que probar en todas las revisiones de esta app. Cada revisión añade lo suyo.</p>
        <ul className="mt-3 grid gap-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <input
                className="input"
                value={it.title}
                disabled={!can}
                aria-label={`Flujo crítico ${i + 1}`}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
              {can && (
                <button className="btn btn-danger" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Quitar flujo ${i + 1}`}>
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
        {can && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn btn-sm" onClick={() => setItems([...items, { title: "" }])}>
              <Plus size={14} aria-hidden /> Añadir flujo
            </button>
            <button className="btn btn-strong btn-sm" onClick={save}>
              Guardar cambios
            </button>
            <span className="text-sm text-ok" aria-live="polite">
              {saved}
            </span>
          </div>
        )}
      </section>

      {d.me.can.manage && (
        <section className="card p-5" aria-labelledby="s-members">
          <h2 id="s-members" className="section-title">
            Personas con cuenta
          </h2>
          <p className="hint">Solo ellas pueden aprobar o pedir cambios. Editor: publica, edita y resuelve. Revisor: prueba, comenta y aprueba.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {d.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  {m.name} <span className="text-muted">{m.email}</span>
                </span>
                <span className="chip bg-neutral text-ink">{ROLE[m.role] ?? m.role}</span>
                {m.role !== "owner" && (
                  <button
                    className="btn btn-danger btn-sm"
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
              const form = e.currentTarget;
              const f = Object.fromEntries(new FormData(form));
              run(async () => {
                await api(`/api/projects/${pid}/members`, { method: "POST", json: f });
                form.reset();
                reload();
              });
            }}
          >
            <input name="email" type="email" required placeholder="Correo de su cuenta" aria-label="Correo" className="input max-w-xs" />
            <select name="role" className="input w-auto" aria-label="Papel">
              <option value="reviewer">Revisor</option>
              <option value="editor">Editor</option>
            </select>
            <button className="btn">Añadir</button>
          </form>
        </section>
      )}

      {d.me.can.publish && (
        <section className="card p-5" aria-labelledby="s-links">
          <h2 id="s-links" className="section-title">
            Enlaces de invitado
          </h2>
          <p className="hint">Se crean desde cada revisión con «Compartir» y solo abren esa revisión. Revocar corta el acceso al momento, también a capturas y vídeos.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {visibleLinks.length === 0 && <li className="py-3 text-muted">No hay enlaces activos.</li>}
            {visibleLinks.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  {l.label}
                  <span className="block text-[13px] text-muted">
                    {l.review ? `#${l.review.number} ${l.review.title}` : "Toda la app (enlace antiguo)"}
                    {l.expiresAt ? `, caduca ${fmtDate(l.expiresAt)}` : ""}
                  </span>
                </span>
                {active(l) ? (
                  <button className="btn btn-danger btn-sm" onClick={() => run(async () => (await api(`/api/projects/${pid}/links/${l.id}`, { method: "DELETE" }), loadAccess()))}>
                    Revocar
                  </button>
                ) : (
                  <span className="chip bg-neutral text-muted">{l.revoked ? "Revocado" : "Caducado"}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.me.can.manage && (
        <section className="card p-5" aria-labelledby="s-keys">
          <h2 id="s-keys" className="section-title">
            Claves para tu agente
          </h2>
          <p className="hint">Para la CLI y el MCP. Solo publican versiones y leen el feedback de esta app: no comentan, no resuelven, no aprueban.</p>
          {secret && (
            <div className="mt-3 rounded-lg border border-accent/50 bg-sunken p-3">
              <p className="text-sm font-medium">Cópiala ahora. No se vuelve a mostrar.</p>
              <code data-testid="secret" className="mt-2 block break-all font-mono text-xs">
                {secret}
              </code>
              <div className="mt-2">
                <CopyButton text={secret} />
              </div>
            </div>
          )}
          <ul className="mt-3 divide-y divide-line text-sm">
            {visibleKeys.length === 0 && <li className="py-3 text-muted">No hay claves activas.</li>}
            {visibleKeys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  {k.label} <code className="font-mono text-xs text-muted">{k.prefix}…</code>
                </span>
                {k.revoked ? (
                  <span className="chip bg-neutral text-muted">Revocada</span>
                ) : (
                  <button className="btn btn-danger btn-sm" onClick={() => run(async () => (await api(`/api/projects/${pid}/keys/${k.id}`, { method: "DELETE" }), loadAccess()))}>
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
              const label = new FormData(e.currentTarget).get("label");
              run(async () => {
                const r = await api(`/api/projects/${pid}/keys`, { method: "POST", json: { label } });
                setSecret(r.key);
                loadAccess();
              });
            }}
          >
            <input name="label" required placeholder="Por ejemplo: Claude Code del portátil" aria-label="Nombre de la clave" className="input max-w-xs" />
            <button className="btn">Crear clave</button>
          </form>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-xs leading-relaxed text-ink">{`export VISTAZO_URL=${typeof location !== "undefined" ? location.origin : ""}
export VISTAZO_PROJECT=${pid}
export VISTAZO_API_KEY=vzk_…        # nunca en el repo
vistazo publish --capture --title "…"   # usa la rama actual como revisión
vistazo feedback                        # feedback de la revisión de tu rama`}</pre>
        </section>
      )}
      {hidden > 0 && (
        <button className="btn btn-quiet btn-sm justify-self-start text-muted" onClick={() => setShowRevoked((v) => !v)}>
          {showRevoked ? "Ocultar revocados y caducados" : `Mostrar ${plural(hidden, "revocado o caducado", "revocados o caducados")}`}
        </button>
      )}
    </div>
  );
}
