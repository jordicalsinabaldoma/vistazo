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

const newStep = (n: number): S => ({ key: `step-${n}`, title: `Step ${n}`, assets: [] });
const opt = <span className="font-normal text-muted">(optional)</span>;

/**
 * Publish by hand. Calls the SAME API as the agent (POST /api/projects/:id/revisions),
 * so the result is identical either way.
 */
export default function Publish() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [target, setTarget] = useState("new"); // "new" or the id of an open review
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
    // Each step's URL belonged to the previous version: it is not copied.
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

  // Quick upload: each file is a step; "flow__step.png" lands in place by itself.
  async function quickDrop(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    setBusy((b) => b + list.length);
    for (const file of list) {
      try {
        const a = await uploadFile(id, file);
        const base = file.name.replace(/\.[^.]+$/, "");
        const [fk, sk] = base.includes("__") ? base.split("__") : ["screenshots", base];
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
      setErr(er.message === "Invalid data" ? "Check the fields: links must be full URLs (https://…)." : er.message);
      setSending(false);
    }
  }

  return (
    <>
      <TopBar>
        <Crumb href={`/p/${id}`}>{name || "…"}</Crumb>
        <Crumb>Publish</Crumb>
      </TopBar>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Publish for review</h1>
        <p className="mt-1 max-w-[65ch] text-sm text-muted">
          The same thing your agent does with <code className="font-mono">vistazo publish</code>. A review is one change with its purpose; each round of fixes is a new version inside it.
        </p>

        <section className="card mt-6 grid gap-5 p-5" aria-label="Review details">
          <div>
            <label className="label" htmlFor="target">
              Where
            </label>
            <select id="target" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="new">New review</option>
              {reviews.map((r) => (
                <option key={r.id} value={r.id}>
                  New version (v{r.version + 1}) of #{r.number} {r.title}
                </option>
              ))}
            </select>
          </div>

          {target === "new" ? (
            <>
              <div>
                <label className="label" htmlFor="t">
                  Title
                </label>
                <input id="t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New cart and checkout" required />
              </div>
              <div>
                <label className="label" htmlFor="s">
                  What changes
                </label>
                <textarea id="s" className="input" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What you changed and what to look at." />
              </div>
              <div>
                <label className="label" htmlFor="td">
                  Test notes {opt}
                </label>
                <textarea id="td" className="input font-mono text-[13px]" rows={2} value={testData} onChange={(e) => setTestData(e.target.value)} placeholder="Test user, test card…" />
                <p className="hint">Test data only. Never real passwords or real data.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="br">
                    Branch {opt}
                  </label>
                  <input id="br" className="input font-mono text-[13px]" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="feature/checkout" />
                </div>
                <div>
                  <label className="label" htmlFor="pr">
                    PR link {opt}
                  </label>
                  <input id="pr" type="url" className="input" value={prUrl} onChange={(e) => setPrUrl(e.target.value)} placeholder="https://github.com/…/pull/42" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="t">
                  Title of this version {opt}
                </label>
                <input id="t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={current?.title} />
              </div>
              <div>
                <label className="label" htmlFor="s">
                  What changes in this version
                </label>
                <textarea id="s" className="input" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What you fixed since the previous version." />
                <p className="hint">The review’s open comments carry over to the new version on their own.</p>
              </div>
              <div>
                <button type="button" className="btn btn-sm" onClick={basedOnPrevious}>
                  Start from v{current?.version}: copy screenshots and links
                </button>
              </div>
            </>
          )}

          <div>
            <label className="label" htmlFor="u">
              Live link {opt}
            </label>
            <input id="u" type="url" className="input" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://… (site or preview)" />
          </div>
          <div>
            <span className="label">Other ways to try it {opt}</span>
            <p className="hint -mt-1 mb-2">Expo QR, a link that opens the app, a download.</p>
            {previews.map((p, i) => (
              <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[130px_1fr_2fr_auto]">
                <select
                  className="input"
                  aria-label="Type"
                  value={p.kind}
                  onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, kind: e.target.value as Pv["kind"] } : x)))}
                >
                  <option value="qr">QR</option>
                  <option value="deeplink">App link</option>
                  <option value="download">Download</option>
                  <option value="web">Web</option>
                </select>
                <input className="input" placeholder="Label" aria-label="Label" value={p.label} onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="input" placeholder="URL" aria-label="URL" value={p.url} onChange={(e) => setPreviews(previews.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                <button type="button" className="btn btn-danger" onClick={() => setPreviews(previews.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => setPreviews([...previews, { kind: "qr", label: "", url: "" }])}>
              <Plus size={14} aria-hidden /> Add
            </button>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="caps">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="caps" className="text-lg font-semibold">
              Screenshots by step
            </h2>
            <div className="flex gap-2">
              <label className="btn btn-sm cursor-pointer">
                <UploadSimple size={15} aria-hidden /> Quick upload
                <input type="file" multiple hidden accept="image/*,video/*,.pdf,.zip,.html" onChange={(e) => quickDrop(e.target.files)} />
              </label>
              <button className="btn btn-sm" onClick={() => setFlows([...flows, { key: `flow-${flows.length + 1}`, title: "", steps: [newStep(1)] }])}>
                <Plus size={14} aria-hidden /> Flow
              </button>
            </div>
          </div>
          <p className="mt-1 max-w-[65ch] text-sm text-muted">
            Screenshots, videos or files for each step. With quick upload, a file named <code className="font-mono">flow__step.png</code> lands in place by itself. For native apps (Expo, iOS, Android), upload the device screenshots here.
          </p>
          {busy > 0 && (
            <p className="mt-2 text-sm text-warn" role="status">
              Uploading {busy}…
            </p>
          )}

          {flows.map((f, fi) => (
            <div key={fi} className="card mt-4 p-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <input
                  className="input font-medium"
                  placeholder="Flow name"
                  aria-label="Flow name"
                  value={f.title}
                  onChange={(e) => upd(fi, (x) => ({ ...x, title: e.target.value, key: x.key.startsWith("flow-") ? slug(e.target.value) : x.key }))}
                />
                <input className="input font-mono text-xs" aria-label="Stable flow key" title="Stable key: used to compare between versions" value={f.key} onChange={(e) => upd(fi, (x) => ({ ...x, key: slug(e.target.value) }))} />
                <div className="flex">
                  <button className="btn btn-quiet px-2" aria-label="Move flow up" onClick={() => setFlows(move(flows, fi, -1))}>
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button className="btn btn-quiet px-2" aria-label="Move flow down" onClick={() => setFlows(move(flows, fi, 1))}>
                    <ArrowDown size={16} aria-hidden />
                  </button>
                  <button className="btn btn-danger px-2" aria-label="Remove flow" onClick={() => setFlows(flows.filter((_, j) => j !== fi))}>
                    <Trash size={16} aria-hidden />
                  </button>
                </div>
              </div>
              <textarea
                className="input mt-2"
                rows={2}
                aria-label="Flow description"
                placeholder='Describe it in words: "sign in as a customer, create an order and reach checkout"'
                value={f.description ?? ""}
                onChange={(e) => upd(fi, (x) => ({ ...x, description: e.target.value }))}
              />
              <ol className="mt-3 grid gap-3">
                {f.steps.map((s, si) => (
                  <li key={si} className="rounded-xl border border-line p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        className="input"
                        aria-label={`Step ${si + 1}`}
                        value={s.title}
                        onChange={(e) => updStep(fi, si, (x) => ({ ...x, title: e.target.value, key: /^step-\d+$/.test(x.key) ? slug(e.target.value) : x.key }))}
                      />
                      <input className="input" placeholder="Screen or URL" aria-label="Screen or URL" value={s.url ?? ""} onChange={(e) => updStep(fi, si, (x) => ({ ...x, url: e.target.value }))} />
                      <div className="flex">
                        <button className="btn btn-quiet px-2" aria-label="Move step up" onClick={() => upd(fi, (x) => ({ ...x, steps: move(x.steps, si, -1) }))}>
                          <ArrowUp size={16} aria-hidden />
                        </button>
                        <button className="btn btn-quiet px-2" aria-label="Move step down" onClick={() => upd(fi, (x) => ({ ...x, steps: move(x.steps, si, 1) }))}>
                          <ArrowDown size={16} aria-hidden />
                        </button>
                        <button className="btn btn-danger px-2" aria-label="Remove step" onClick={() => upd(fi, (x) => ({ ...x, steps: x.steps.filter((_, j) => j !== si) }))}>
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
                            aria-label={`Remove ${a.name}`}
                            onClick={() => updStep(fi, si, (x) => ({ ...x, assets: x.assets.filter((_, j) => j !== ai) }))}
                          >
                            <Trash size={12} aria-hidden />
                          </button>
                        </div>
                      ))}
                      <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-field text-xs text-muted hover:border-ink/50 hover:text-ink">
                        <Plus size={16} aria-hidden />
                        Attach
                        <input type="file" multiple hidden accept="image/*,video/*,.pdf,.zip,.html" onChange={(e) => addFiles(fi, si, e.target.files)} />
                      </label>
                    </div>
                  </li>
                ))}
              </ol>
              <button className="btn btn-sm mt-3" onClick={() => upd(fi, (x) => ({ ...x, steps: [...x.steps, newStep(x.steps.length + 1)] }))}>
                <Plus size={14} aria-hidden /> Step
              </button>
            </div>
          ))}
        </section>

        <div className="mt-6">
          <ErrorNote>{err}</ErrorNote>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={!ready || busy > 0 || sending} onClick={publish}>
            {target === "new" ? "Publish review" : `Publish v${(current?.version ?? 0) + 1}`}
          </button>
          <Link href={`/p/${id}`} className="btn btn-quiet">
            Cancel
          </Link>
        </div>
      </main>
    </>
  );
}
