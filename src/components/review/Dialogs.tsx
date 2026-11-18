"use client";
import { Plus } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { CopyButton, ErrorNote, Sheet, plural } from "@/components/ui";
import { api, fmtDate } from "@/lib/client";
import type { Ctx } from "./types";

// ---------- Terminar revisión ----------

type Kind = "approve" | "changes" | "comment";

export function FinishDialog({ open, ctx, onClose, onDone }: { open: boolean; ctx: Ctx; onClose: () => void; onDone: () => void }) {
  const { me, revision: r, review: rv, project: p, comments } = ctx.data;
  const guest = me.kind !== "user";
  const canVerdict = me.can.approve && !guest && !me.isAuthor;
  const [kind, setKind] = useState<Kind>(canVerdict ? "approve" : "comment");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const open_ = comments.filter((c) => c.status === "open").length;
  const items = [...(rv.testPlan ?? []), ...p.checklist];
  const untested = items.filter((i) => r.checks[i.id]?.status !== "ok").length;
  const failing = items.filter((i) => r.checks[i.id]?.status === "fail").length;

  const options: [Kind, string, string][] = [
    ["approve", "Aprobar", "Está bien así. Es una aprobación visual: no hace merge ni despliega."],
    ["changes", "Pedir cambios", "Hay que corregir algo antes de darla por buena."],
    ["comment", guest ? "Enviar comentarios" : "Solo comentar", "Dejas tus comentarios sin aprobar ni pedir cambios."],
  ];

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/revisions/${r.id}/verdict`, { method: "POST", json: { kind, note: note.trim() || undefined } });
      setNote("");
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Terminar tu revisión de la v${r.number}`} description="Así el equipo sabe que ya has terminado y qué le toca.">
      <fieldset className="grid gap-2">
        <legend className="sr-only">Resultado</legend>
        {options.map(([k, label, help]) => {
          const disabled = k !== "comment" && !canVerdict;
          return (
            <label
              key={k}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${kind === k ? "border-accent bg-accent/5" : "border-line hover:border-field"} ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
            >
              <input type="radio" name="verdict" value={k} checked={kind === k} disabled={disabled} onChange={() => setKind(k)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted">
                  {disabled ? (me.isAuthor ? "No puedes aprobar ni pedir cambios en tu propia revisión." : "Solo personas con cuenta en la app.") : help}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {kind === "approve" && (open_ > 0 || untested > 0) && (
        <p className="mt-3 rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="status">
          Ojo: {[open_ ? plural(open_, "comentario sigue abierto", "comentarios siguen abiertos") : "", untested ? `${plural(untested, "cosa", "cosas")} sin marcar como probada${untested === 1 ? "" : "s"}` : ""].filter(Boolean).join(" y ")}
          {failing ? ` (${plural(failing, "falla", "fallan")})` : ""}. Puedes aprobar igualmente.
        </p>
      )}
      <label className="label mt-4" htmlFor="verdict-note">
        Nota <span className="font-normal text-muted">(opcional)</span>
      </label>
      <textarea id="verdict-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Un resumen para el equipo" />
      <div className="mt-3">
        <ErrorNote>{err}</ErrorNote>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-quiet" onClick={onClose}>
          Seguir revisando
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={busy} data-testid="submit-verdict">
          {kind === "approve" ? "Aprobar" : kind === "changes" ? "Pedir cambios" : "Enviar"}
        </button>
      </div>
    </Sheet>
  );
}

// ---------- Compartir ----------

type L = { id: string; label: string; revoked: boolean; active: boolean; createdAt: number; expiresAt?: number };

export function ShareDialog({ open, ctx, onClose }: { open: boolean; ctx: Ctx; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Compartir para revisar" description={`El enlace solo abre la revisión #${ctx.data.review.number}. Quien lo tenga puede probarla y comentar sin cuenta, pero no aprobar.`}>
      <ShareBody ctx={ctx} />
    </Sheet>
  );
}

/** Se monta cada vez que se abre el diálogo: el enlace recién creado no sobrevive al cierre. */
function ShareBody({ ctx }: { ctx: Ctx }) {
  const { review: rv, project: p, me } = ctx.data;
  const [links, setLinks] = useState<L[]>([]);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(() => api<{ links: L[] }>(`/api/reviews/${rv.id}/links`).then((r) => setLinks(r.links)), [rv.id]);
  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);
  const active = links.filter((l) => l.active);

  return (
    <>
      <ErrorNote>{err}</ErrorNote>
      {url ? (
        <div className="rounded-xl border border-accent/50 bg-sunken p-3">
          <p className="text-sm font-medium">Enlace creado. Cópialo ahora: no se vuelve a mostrar.</p>
          <code data-testid="share-url" className="mt-2 block break-all font-mono text-xs">
            {url}
          </code>
          <div className="mt-2">
            <CopyButton text={url} className="btn btn-primary btn-sm" label="Copiar enlace" />
          </div>
        </div>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setErr("");
            try {
              const r = await api(`/api/reviews/${rv.id}/links`, { method: "POST", json: { label: f.get("label"), days: f.get("days") ? Number(f.get("days")) : undefined } });
              setUrl(r.url);
              load();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          <div>
            <label className="label" htmlFor="sl">
              Para quién
            </label>
            <input id="sl" name="label" required placeholder="Por ejemplo: Ana, diseñadora" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="sd">
              Caduca
            </label>
            <select id="sd" name="days" className="input w-auto" defaultValue="14">
              <option value="7">En 7 días</option>
              <option value="14">En 14 días</option>
              <option value="30">En 30 días</option>
              <option value="">Nunca</option>
            </select>
          </div>
          <button className="btn btn-primary">Crear enlace</button>
        </form>
      )}

      <h3 className="mt-6 text-sm font-semibold">Enlaces activos de esta revisión</h3>
      <ul className="mt-2 divide-y divide-line text-sm">
        {active.length === 0 && <li className="py-2 text-muted">Ninguno.</li>}
        {active.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2">
            <span className="flex-1">
              {l.label}
              <span className="block text-xs text-muted">{l.expiresAt ? `Caduca ${fmtDate(l.expiresAt)}` : "Sin caducidad"}</span>
            </span>
            <button
              className="btn btn-danger btn-sm"
              onClick={async () => {
                await api(`/api/projects/${p.id}/links/${l.id}`, { method: "DELETE" });
                load();
              }}
            >
              Revocar
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        Para que alguien pueda <b className="font-medium text-ink">aprobar</b>, tiene que tener cuenta y estar en la app.{" "}
        {me.can.manage ? (
          <a className="font-medium text-accent-ink underline" href={`/p/${p.id}#ajustes`}>
            Añádelo en Ajustes
          </a>
        ) : (
          "Pídeselo a quien gestiona la app."
        )}
      </p>
    </>
  );
}

// ---------- Editar revisión ----------

type Item = { id?: string; title: string };

export function EditDialog({ open, ctx, onClose }: { open: boolean; ctx: Ctx; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={`Editar la revisión #${ctx.data.review.number}`}>
      <EditForm ctx={ctx} onClose={onClose} />
    </Sheet>
  );
}

/** Se monta al abrir: parte siempre de los datos actuales de la revisión. */
function EditForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const rv = ctx.data.review;
  const [f, setF] = useState({ title: rv.title, purpose: rv.purpose, testData: rv.testData ?? "", branch: rv.branch ?? "", prUrl: rv.prUrl ?? "" });
  const [items, setItems] = useState<Item[]>(rv.testPlan ?? []);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          try {
            await api(`/api/reviews/${rv.id}`, { method: "PATCH", json: { ...f, testPlan: items.filter((i) => i.title.trim()) } });
            onClose();
          } catch (e) {
            const er = e as Error & { status?: number };
            setErr(er.message === "Datos no válidos" ? "Revisa los campos: el enlace a la PR tiene que empezar por https://" : er.message);
          }
        }}
      >
        <div>
          <label className="label" htmlFor="e-title">
            Título
          </label>
          <input id="e-title" className="input" required value={f.title} onChange={set("title")} />
        </div>
        <div>
          <label className="label" htmlFor="e-purpose">
            Qué cambia
          </label>
          <textarea id="e-purpose" className="input" rows={4} value={f.purpose} onChange={set("purpose")} />
        </div>
        <div>
          <span className="label">Qué probar en esta revisión</span>
          <ul className="grid gap-2">
            {items.map((it, i) => (
              <li key={i} className="flex gap-2">
                <input
                  className="input"
                  value={it.title}
                  aria-label={`Qué probar ${i + 1}`}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                />
                <button type="button" className="btn btn-danger" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-sm mt-2" onClick={() => setItems([...items, { title: "" }])}>
            <Plus size={14} aria-hidden /> Añadir
          </button>
          <p className="hint">Los flujos críticos de la app se añaden solos.</p>
        </div>
        <div>
          <label className="label" htmlFor="e-data">
            Datos de prueba
          </label>
          <textarea id="e-data" className="input font-mono text-[13px]" rows={3} value={f.testData} onChange={set("testData")} placeholder="Usuario: cliente@ejemplo.test / contraseña de prueba" />
          <p className="hint">Solo datos de prueba. Nunca contraseñas ni datos reales.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="e-branch">
              Rama
            </label>
            <input id="e-branch" className="input font-mono text-[13px]" value={f.branch} onChange={set("branch")} placeholder="feature/pago" />
          </div>
          <div>
            <label className="label" htmlFor="e-pr">
              Enlace a la PR
            </label>
            <input id="e-pr" type="url" className="input" value={f.prUrl} onChange={set("prUrl")} placeholder="https://github.com/…/pull/42" />
          </div>
        </div>
        <ErrorNote>{err}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary">Guardar</button>
        </div>
      </form>
  );
}
