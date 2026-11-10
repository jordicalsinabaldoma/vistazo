"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { api, fileUrl, slug, uploadFile } from "@/lib/client";

type A = Awaited<ReturnType<typeof uploadFile>> & { origin: string; caption?: string };
type S = { key: string; title: string; notes?: string; url?: string; assets: A[] };
type F = { key: string; title: string; description?: string; steps: S[] };
type Pv = { kind: "web" | "qr" | "deeplink" | "download"; label: string; url: string; instructions?: string };

const newStep = (n: number): S => ({ key: `paso-${n}`, title: `Paso ${n}`, assets: [] });

export default function NewRevision() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [previews, setPreviews] = useState<Pv[]>([]);
  const [flows, setFlows] = useState<F[]>([]);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const [prev, setPrev] = useState<{ id: string; number: number } | null>(null);

  useEffect(() => {
    api(`/api/projects/${id}`).then((d) => {
      setName(d.project.name);
      if (d.revisions[0]) setPrev({ id: d.revisions[0].id, number: d.revisions[0].number });
    });
  }, [id]);

  async function basedOnPrevious() {
    if (!prev) return;
    const d = await api(`/api/revisions/${prev.id}`);
    const r = d.revision;
    setSummary(r.summary);
    setLiveUrl(r.liveUrl ?? "");
    setPreviews(r.previews ?? []);
    setFlows(r.flows.map((f: F) => ({ ...f, // La URL de cada paso era de la versión anterior: no se copia.
    steps: f.steps.map(({ url: _u, ...s }) => ({ ...s, assets: s.assets.map(({ id: _i, ...a }: any) => a) })) })));
  }

  const upd = (fi: number, fn: (f: F) => F) => setFlows((fs) => fs.map((f, i) => (i === fi ? fn(f) : f)));
  const updStep = (fi: number, si: number, fn: (s: S) => S) =>
    upd(fi, (f) => ({ ...f, steps: f.steps.map((s, j) => (j === si ? fn(s) : s)) }));
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

  // Subida rápida: cada fichero = un paso. «flujo__paso.png» se coloca solo.
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

  async function publish() {
    setErr("");
    try {
      const r = await api(`/api/projects/${id}/revisions`, {
        method: "POST",
        json: { title, summary, liveUrl: liveUrl || undefined, previews, flows, source: "form" },
      });
      location.href = `/r/${r.id}`;
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <TopBar>
        <Link href={`/p/${id}`} className="hover:underline">
          {name}
        </Link>{" "}
        / Publicar revisión
      </TopBar>
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Publicar revisión</h1>
          {prev && (
            <button className="btn" onClick={basedOnPrevious}>
              Partir de v{prev.number} (corregir, ordenar, añadir)
            </button>
          )}
        </div>

        <section className="card mt-6 grid gap-4 p-5">
          <div>
            <label className="label" htmlFor="t">
              Título
            </label>
            <input id="t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nuevo carrito y pago" />
          </div>
          <div>
            <label className="label" htmlFor="s">
              Contexto de esta versión
            </label>
            <textarea
              id="s"
              className="input"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Qué cambia, qué mirar, usuario de prueba…"
            />
          </div>
          <div>
            <label className="label" htmlFor="u">
              Enlace en vivo (web o preview)
            </label>
            <input id="u" className="input" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <span className="label">Otras vías de prueba (QR de Expo, deep link, descarga…)</span>
            {previews.map((p, i) => (
              <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[120px_1fr_2fr_auto]">
                <select
                  className="input"
                  value={p.kind}
                  onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, kind: e.target.value as Pv["kind"] } : x)))}
                >
                  <option value="qr">QR</option>
                  <option value="deeplink">Deep link</option>
                  <option value="download">Descarga</option>
                  <option value="web">Web</option>
                </select>
                <input
                  className="input"
                  placeholder="Etiqueta"
                  value={p.label}
                  onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className="input"
                  placeholder="URL"
                  value={p.url}
                  onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                />
                <button className="btn btn-ghost" onClick={() => setPreviews(previews.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <button className="btn" onClick={() => setPreviews([...previews, { kind: "qr", label: "", url: "" }])}>
              + Vía de prueba
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recorridos y capturas</h2>
            <div className="flex gap-2">
              <label className="btn cursor-pointer">
                Subida rápida
                <input type="file" multiple hidden accept="image/*,video/*,.pdf,.zip,.html" onChange={(e) => quickDrop(e.target.files)} />
              </label>
              <button
                className="btn"
                onClick={() => setFlows([...flows, { key: `recorrido-${flows.length + 1}`, title: "", steps: [newStep(1)] }])}
              >
                + Recorrido
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-muted">
            Capturas, vídeos o artifacts por paso. En la subida rápida, <code>recorrido__paso.png</code> se coloca solo. Para apps
            nativas (Expo, iOS, Android) esta es la vía: sube las capturas del dispositivo.
          </p>
          {busy > 0 && <p className="mt-2 text-sm text-warn">Subiendo {busy}…</p>}

          {flows.map((f, fi) => (
            <div key={fi} className="card mt-4 p-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <input
                  className="input font-medium"
                  placeholder="Título del recorrido"
                  value={f.title}
                  onChange={(e) => upd(fi, (x) => ({ ...x, title: e.target.value, key: x.key.startsWith("recorrido-") ? slug(e.target.value) : x.key }))}
                />
                <input className="input font-mono text-xs" value={f.key} onChange={(e) => upd(fi, (x) => ({ ...x, key: slug(e.target.value) }))} />
                <div className="flex">
                  <button className="btn btn-ghost" onClick={() => setFlows(move(flows, fi, -1))}>↑</button>
                  <button className="btn btn-ghost" onClick={() => setFlows(move(flows, fi, 1))}>↓</button>
                  <button className="btn btn-ghost text-bad" onClick={() => setFlows(flows.filter((_, j) => j !== fi))}>✕</button>
                </div>
              </div>
              <textarea
                className="input mt-2"
                rows={2}
                placeholder="Descríbelo en lenguaje natural: «entra como cliente, crea un pedido y llega al pago»"
                value={f.description ?? ""}
                onChange={(e) => upd(fi, (x) => ({ ...x, description: e.target.value }))}
              />
              <ol className="mt-3 grid gap-3">
                {f.steps.map((s, si) => (
                  <li key={si} className="rounded-lg border border-line p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        className="input"
                        value={s.title}
                        onChange={(e) => updStep(fi, si, (x) => ({ ...x, title: e.target.value, key: /^paso-\d+$/.test(x.key) ? slug(e.target.value) : x.key }))}
                      />
                      <input
                        className="input"
                        placeholder="Dónde capturar (URL o pantalla)"
                        value={s.url ?? ""}
                        onChange={(e) => updStep(fi, si, (x) => ({ ...x, url: e.target.value }))}
                      />
                      <div className="flex">
                        <button className="btn btn-ghost" onClick={() => upd(fi, (x) => ({ ...x, steps: move(x.steps, si, -1) }))}>↑</button>
                        <button className="btn btn-ghost" onClick={() => upd(fi, (x) => ({ ...x, steps: move(x.steps, si, 1) }))}>↓</button>
                        <button className="btn btn-ghost text-bad" onClick={() => upd(fi, (x) => ({ ...x, steps: x.steps.filter((_, j) => j !== si) }))}>✕</button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.assets.map((a, ai) => (
                        <div key={ai} className="relative h-24 w-24 overflow-hidden rounded border border-line bg-paper text-[10px]">
                          {a.kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fileUrl(a.pathname)} alt={a.name} className="h-full w-full object-cover object-top" />
                          ) : (
                            <span className="flex h-full items-center justify-center p-1 text-center">{a.kind}: {a.name}</span>
                          )}
                          <button
                            className="absolute right-0 top-0 bg-ink/80 px-1 text-white"
                            onClick={() => updStep(fi, si, (x) => ({ ...x, assets: x.assets.filter((_, j) => j !== ai) }))}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded border border-dashed border-line text-xs text-muted hover:border-ink/40">
                        + Adjuntar
                        <input type="file" multiple hidden accept="image/*,video/*,.pdf,.zip,.html" onChange={(e) => addFiles(fi, si, e.target.files)} />
                      </label>
                    </div>
                  </li>
                ))}
              </ol>
              <button className="btn mt-3" onClick={() => upd(fi, (x) => ({ ...x, steps: [...x.steps, newStep(x.steps.length + 1)] }))}>
                + Paso
              </button>
            </div>
          ))}
        </section>

        {err && <p className="mt-6 rounded-md bg-badbg px-3 py-2 text-sm text-bad">{err}</p>}
        <div className="mt-6 flex gap-3">
          <button className="btn btn-accent" disabled={!title || busy > 0} onClick={publish}>
            Publicar revisión
          </button>
          <Link href={`/p/${id}`} className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </main>
    </>
  );
}
