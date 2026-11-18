"use client";
import { ArrowDown, ArrowUp, Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TopBar, { Crumb } from "@/components/TopBar";
import { ErrorNote } from "@/components/ui";
import { api, fileUrl, slug, uploadFile } from "@/lib/client";
import type { ReviewSummary } from "@/lib/revisions";

type A = Awaited<ReturnType<typeof uploadFile>> & { origin: string; caption?: string };
type S = { key: string; title: string; notes?: string; url?: string; assets: A[] };
type F = { key: string; title: string; description?: string; steps: S[] };
type Pv = { kind: "web" | "qr" | "deeplink" | "download"; label: string; url: string; instructions?: string };

const newStep = (n: number): S => ({ key: `paso-${n}`, title: `Paso ${n}`, assets: [] });
const opt = <span className="font-normal text-muted">(opcional)</span>;

/**
 * Publicar a mano. Llama a la MISMA API que el agente (POST /api/projects/:id/revisions),
 * así el resultado es idéntico por las dos vías.
 */
export default function Publish() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [target, setTarget] = useState("new"); // "new" o id de una revisión abierta
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [testData, setTestData] = useState("");
  const [branch, setBranch] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [previews, setPreviews] = useState<Pv[]>([]);
  const [flows, setFlows] = useState<F[]>([]);
  const [busy, setBusy] = useState(0);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api(`/api/projects/${id}`)
      .then((d) => {
        setName(d.project.name);
        const open = (d.reviews as ReviewSummary[]).filter((r) => r.status === "open");
        setReviews(open);
        const want = new URLSearchParams(location.search).get("revision");
        if (want && open.some((r) => r.id === want)) setTarget(want);
      })
      .catch((e) => (e.status === 401 ? (location.href = "/") : setErr(e.message)));
  }, [id]);
  const current = reviews.find((r) => r.id === target);

  async function basedOnPrevious() {
    if (!current) return;
    const d = await api(`/api/revisions/${current.latestRevisionId}`);
    const r = d.revision;
    setLiveUrl(r.liveUrl ?? "");
    setPreviews(r.previews ?? []);
    // La URL de cada paso era de la versión anterior: no se copia.
    setFlows(
      r.flows.map((f: F) => ({
        ...f,
        steps: f.steps.map(({ url: _u, ...s }) => ({ ...s, assets: s.assets.map(({ id: _i, ...a }: A & { id?: string }) => a) })),
      })),
    );
  }

  const upd = (fi: number, fn: (f: F) => F) => setFlows((fs) => fs.map((f, i) => (i === fi ? fn(f) : f)));
  const updStep = (fi: number, si: number, fn: (s: S) => S) => upd(fi, (f) => ({ ...f, steps: f.steps.map((s, j) => (j === si ? fn(s) : s)) }));
  const move = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const c = [...arr];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };

  async function addFiles(fi: number, si: number, files: FileList | null) {
    if (!files?.length) return;
    setBusy((b) => b + files.length);
    for (const file of Array.from(files)) {
      try {
        const a = await uploadFile(id, file);
        updStep(fi, si, (s) => ({ ...s, assets: [...s.assets, a] }));
      } catch (e) {
        setErr(`${file.name}: ${(e as Error).message}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
  }

  // Subida rápida: cada fichero es un paso; «recorrido__paso.png» se coloca solo.
  async function quickDrop(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    setBusy((b) => b + list.length);
    for (const file of list) {
      try {
        const a = await uploadFile(id, file);
        const base = file.name.replace(/\.[^.]+$/, "");
        const [fk, sk] = base.includes("__") ? base.split("__") : ["capturas", base];
        setFlows((fs) => {
          const c = fs.map((f) => ({ ...f, steps: [...f.steps] }));
          let f = c.find((x) => x.key === slug(fk));
          if (!f) {
            f = { key: slug(fk), title: fk.replace(/[-_]/g, " "), steps: [] };
            c.push(f);
          }
          let s = f.steps.find((x) => x.key === slug(sk));
          if (!s) {
            s = { key: slug(sk), title: sk.replace(/^\d+[-_ ]*/, "").replace(/[-_]/g, " ") || sk, assets: [] };
            f.steps.push(s);
          }
          s.assets = [...s.assets, a];
          return c;
        });
      } catch (e) {
        setErr(`${file.name}: ${(e as Error).message}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
  }

  const ready = target === "new" ? !!title.trim() : !!current;

  async function publish() {
    setErr("");
    setSending(true);
    try {
      const r = await api(`/api/projects/${id}/revisions`, {
        method: "POST",
        json: {
          title: title.trim() || current?.title || "",
          summary,
          liveUrl: liveUrl || undefined,
          previews: previews.filter((p) => p.url.trim()),
          flows,
          source: "form",
          review: target === "new" ? { title: title.trim(), purpose: summary, testData, branch: branch.trim() || undefined, prUrl: prUrl.trim() || undefined } : { id: target },
        },
      });
      location.href = `/r/${r.id}`;
    } catch (e) {
      const er = e as Error;
      setErr(er.message === "Datos no válidos" ? "Revisa los campos: los enlaces tienen que ser URLs completas (https://…)." : er.message);
      setSending(false);
    }
  }

  return (
    <>
      <TopBar>
        <Crumb href={`/p/${id}`}>{name || "…"}</Crumb>
        <Crumb>Publicar</Crumb>
      </TopBar>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Publicar para revisar</h1>
        <p className="mt-1 max-w-[65ch] text-sm text-muted">
          Lo mismo que hace tu agente con <code className="font-mono">vistazo publish</code>. Una revisión es un cambio con su propósito; cada vuelta de corrección es una versión nueva dentro de ella.
        </p>

        <section className="card mt-6 grid gap-5 p-5" aria-label="Datos de la revisión">
          <div>
            <label className="label" htmlFor="target">
              Dónde
            </label>
            <select id="target" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="new">Revisión nueva</option>
              {reviews.map((r) => (
                <option key={r.id} value={r.id}>
                  Versión nueva (v{r.version + 1}) de #{r.number} {r.title}
                </option>
              ))}
            </select>
          </div>

          {target === "new" ? (
            <>
              <div>
                <label className="label" htmlFor="t">
                  Título
                </label>
                <input id="t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nuevo carrito y pago" required />
              </div>
              <div>
                <label className="label" htmlFor="s">
                  Qué cambia
                </label>
                <textarea id="s" className="input" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Qué has cambiado y qué hay que mirar." />
              </div>
              <div>
                <label className="label" htmlFor="td">
                  Datos de prueba {opt}
                </label>
                <textarea id="td" className="input font-mono text-[13px]" rows={2} value={testData} onChange={(e) => setTestData(e.target.value)} placeholder="Usuario de prueba, tarjeta de test…" />
                <p className="hint">Solo datos de prueba. Nunca contraseñas ni datos reales.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="br">
                    Rama {opt}
                  </label>
                  <input id="br" className="input font-mono text-[13px]" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="feature/pago" />
                </div>
                <div>
                  <label className="label" htmlFor="pr">
                    Enlace a la PR {opt}
                  </label>
                  <input id="pr" type="url" className="input" value={prUrl} onChange={(e) => setPrUrl(e.target.value)} placeholder="https://github.com/…/pull/42" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="t">
                  Título de esta versión {opt}
                </label>
                <input id="t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={current?.title} />
              </div>
              <div>
                <label className="label" htmlFor="s">
                  Qué cambia en esta versión
                </label>
                <textarea id="s" className="input" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Qué has corregido desde la versión anterior." />
                <p className="hint">Los comentarios abiertos de la revisión pasan solos a la versión nueva.</p>
              </div>
              <div>
                <button type="button" className="btn btn-sm" onClick={basedOnPrevious}>
                  Partir de la v{current?.version}: copiar capturas y enlaces
                </button>
              </div>
            </>
          )}

          <div>
            <label className="label" htmlFor="u">
              Enlace en vivo {opt}
            </label>
            <input id="u" type="url" className="input" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://… (web o preview)" />
          </div>
          <div>
            <span className="label">Otras formas de probarla {opt}</span>
            <p className="hint -mt-1 mb-2">QR de Expo, enlace que abre la app, descarga.</p>
            {previews.map((p, i) => (
              <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[130px_1fr_2fr_auto]">
                <select
                  className="input"
                  aria-label="Tipo"
                  value={p.kind}
                  onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, kind: e.target.value as Pv["kind"] } : x)))}
                >
                  <option value="qr">QR</option>
                  <option value="deeplink">Enlace a la app</option>
                  <option value="download">Descarga</option>
                  <option value="web">Web</option>
                </select>
                <input className="input" placeholder="Etiqueta" aria-label="Etiqueta" value={p.label} onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="input" placeholder="URL" aria-label="URL" value={p.url} onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                <button type="button" className="btn btn-danger" onClick={() => setPreviews(previews.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => setPreviews([...previews, { kind: "qr", label: "", url: "" }])}>
              <Plus size={14} aria-hidden /> Añadir
            </button>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="caps">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="caps" className="text-lg font-semibold">
              Capturas por pasos
            </h2>
            <div className="flex gap-2">
              <label className="btn btn-sm cursor-pointer">
                <UploadSimple size={15} aria-hidden /> Subida rápida
                <input type="file" multiple hidden accept="image/*,video/*,.pdf,.zip,.html" onChange={(e) => quickDrop(e.target.files)} />
              </label>
              <button className="btn btn-sm" onClick={() => setFlows([...flows, { key: `recorrido-${flows.length + 1}`, title: "", steps: [newStep(1)] }])}>
                <Plus size={14} aria-hidden /> Recorrido
              </button>
            </div>
          </div>
          <p className="mt-1 max-w-[65ch] text-sm text-muted">
            Capturas, vídeos o archivos de cada paso. En la subida rápida, un fichero <code className="font-mono">recorrido__paso.png</code> se coloca solo. Para apps nativas (Expo, iOS, Android) sube aquí las capturas del dispositivo.
          </p>
          {busy > 0 && (
            <p className="mt-2 text-sm text-warn" role="status">
              Subiendo {busy}…
            </p>
          )}

          {flows.map((f, fi) => (
            <div key={fi} className="card mt-4 p-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <input
                  className="input font-medium"
                  placeholder="Nombre del recorrido"
                  aria-label="Nombre del recorrido"
                  value={f.title}
                  onChange={(e) => upd(fi, (x) => ({ ...x, title: e.target.value, key: x.key.startsWith("recorrido-") ? slug(e.target.value) : x.key }))}
                />
                <input className="input font-mono text-xs" aria-label="Clave estable del recorrido" title="Clave estable: sirve para comparar entre versiones" value={f.key} onChange={(e) => upd(fi, (x) => ({ ...x, key: slug(e.target.value) }))} />
                <div className="flex">
                  <button className="btn btn-quiet px-2" aria-label="Subir recorrido" onClick={() => setFlows(move(flows, fi, -1))}>
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button className="btn btn-quiet px-2" aria-label="Bajar recorrido" onClick={() => setFlows(move(flows, fi, 1))}>
                    <ArrowDown size={16} aria-hidden />
                  </button>
                  <button className="btn btn-danger px-2" aria-label="Quitar recorrido" onClick={() => setFlows(flows.filter((_, j) => j !== fi))}>
                    <Trash size={16} aria-hidden />
                  </button>
                </div>
              </div>
              <textarea
                className="input mt-2"
                rows={2}
                aria-label="Descripción del recorrido"
                placeholder="Descríbelo con palabras: «entra como cliente, crea un pedido y llega al pago»"
                value={f.description ?? ""}
                onChange={(e) => upd(fi, (x) => ({ ...x, description: e.target.value }))}
              />
              <ol className="mt-3 grid gap-3">
                {f.steps.map((s, si) => (
                  <li key={si} className="rounded-xl border border-line p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        className="input"
                        aria-label={`Paso ${si + 1}`}
                        value={s.title}
                        onChange={(e) => updStep(fi, si, (x) => ({ ...x, title: e.target.value, key: /^paso-\d+$/.test(x.key) ? slug(e.target.value) : x.key }))}
                      />
                      <input className="input" placeholder="Pantalla o URL" aria-label="Pantalla o URL" value={s.url ?? ""} onChange={(e) => updStep(fi, si, (x) => ({ ...x, url: e.target.value }))} />
                      <div className="flex">
                        <button className="btn btn-quiet px-2" aria-label="Subir paso" onClick={() => upd(fi, (x) => ({ ...x, steps: move(x.steps, si, -1) }))}>
                          <ArrowUp size={16} aria-hidden />
                        </button>
                        <button className="btn btn-quiet px-2" aria-label="Bajar paso" onClick={() => upd(fi, (x) => ({ ...x, steps: move(x.steps, si, 1) }))}>
                          <ArrowDown size={16} aria-hidden />
                        </button>
                        <button className="btn btn-danger px-2" aria-label="Quitar paso" onClick={() => upd(fi, (x) => ({ ...x, steps: x.steps.filter((_, j) => j !== si) }))}>
                          <Trash size={16} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.assets.map((a, ai) => (
                        <div key={ai} className="relative h-24 w-24 overflow-hidden rounded-lg border border-line bg-sunken text-xs">
                          {a.kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fileUrl(a.pathname)} alt={a.name} className="h-full w-full object-cover object-top" />
                          ) : (
                            <span className="flex h-full items-center justify-center p-1 text-center">{a.name}</span>
                          )}
                          <button
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-paper"
                            aria-label={`Quitar ${a.name}`}
                            onClick={() => updStep(fi, si, (x) => ({ ...x, assets: x.assets.filter((_, j) => j !== ai) }))}
                          >
                            <Trash size={12} aria-hidden />
                          </button>
                        </div>
                      ))}
                      <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-field text-xs text-muted hover:border-ink/50 hover:text-ink">
                        <Plus size={16} aria-hidden />
                        Adjuntar
                        <input type="file" multiple hidden accept="image/*,video/*,.pdf,.zip,.html" onChange={(e) => addFiles(fi, si, e.target.files)} />
                      </label>
                    </div>
                  </li>
                ))}
              </ol>
              <button className="btn btn-sm mt-3" onClick={() => upd(fi, (x) => ({ ...x, steps: [...x.steps, newStep(x.steps.length + 1)] }))}>
                <Plus size={14} aria-hidden /> Paso
              </button>
            </div>
          ))}
        </section>

        <div className="mt-6">
          <ErrorNote>{err}</ErrorNote>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={!ready || busy > 0 || sending} onClick={publish}>
            {target === "new" ? "Publicar revisión" : `Publicar v${(current?.version ?? 0) + 1}`}
          </button>
          <Link href={`/p/${id}`} className="btn btn-quiet">
            Cancelar
          </Link>
        </div>
      </main>
    </>
  );
}
