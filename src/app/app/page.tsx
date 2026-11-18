"use client";
import { ArrowRight, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { AppMark, ErrorNote, StateLabel, plural } from "@/components/ui";
import { api } from "@/lib/client";
import type { NextStep } from "@/lib/flow";
import type { ReviewSummary } from "@/lib/revisions";

type P = { id: string; name: string; role: string; reviewCount: number | null };
type Item = { project: { id: string; name: string }; review: ReviewSummary; step: NextStep };

const ROLE: Record<string, string> = { owner: "Propietario", editor: "Editor", reviewer: "Revisor" };

export default function Home() {
  const [projects, setProjects] = useState<P[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fail = (e: Error & { status?: number }) => (e.status === 401 ? (location.href = "/") : setErr(e.message));
    api<{ projects: P[] }>("/api/projects").then((r) => setProjects(r.projects)).catch(fail);
    api<{ items: Item[] }>("/api/inbox").then((r) => setItems(r.items)).catch(fail);
  }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api<{ id: string }>("/api/projects", { method: "POST", json: f });
      location.href = `/p/${r.id}`;
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto grid w-full max-w-[1120px] grid-cols-[minmax(0,1fr)] gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        {err && <div className="lg:col-span-2"><ErrorNote>{err}</ErrorNote></div>}
        <section aria-labelledby="toca">
          <h1 id="toca" className="text-2xl font-semibold tracking-tight">
            Te toca
          </h1>
          <p className="mt-1 text-sm text-muted">Revisiones de todas tus apps en las que el siguiente paso es tuyo.</p>
          <ul className="mt-5 grid gap-2">
            {items === null && <li className="h-20 animate-pulse rounded-xl bg-sunken" />}
            {items?.length === 0 && (
              <li className="card px-5 py-8 text-center text-sm text-muted">Nada pendiente. Cuando alguien te pida revisar o te devuelvan feedback, aparecerá aquí.</li>
            )}
            {items?.map(({ project, review: r, step }) => (
              <li key={r.id}>
                <Link
                  href={`/r/${r.latestRevisionId}`}
                  className="card group flex flex-col gap-3 p-4 transition-colors hover:border-field sm:flex-row sm:items-center"
                >
                  <span className="hidden sm:block">
                    <AppMark name={project.name} size={32} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StateLabel stage={r.stage} label={r.stageLabel} />
                      <span className="text-sm text-muted">{project.name}</span>
                    </div>
                    <p className="mt-1.5 font-medium">
                      <span className="text-muted tabular">#{r.number}</span> {r.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{step.text}</p>
                  </div>
                  {step.primary && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink group-hover:underline">
                      {step.primary.label}
                      <ArrowRight size={15} aria-hidden />
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="apps" className="lg:pt-1">
          <div className="flex items-end justify-between gap-4">
            <h2 id="apps" className="text-base font-semibold">
              Tus apps
            </h2>
            <button className="btn btn-sm" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
              <Plus size={15} aria-hidden /> Nueva app
            </button>
          </div>
          {creating && (
            <form onSubmit={create} className="card mt-4 grid gap-4 p-5">
              <div>
                <label className="label" htmlFor="pn">
                  Nombre
                </label>
                <input id="pn" name="name" required className="input" placeholder="App de pedidos" autoFocus />
              </div>
              <div>
                <label className="label" htmlFor="pc">
                  Sobre la app <span className="font-normal text-muted">(opcional)</span>
                </label>
                <textarea id="pc" name="context" rows={3} className="input" placeholder="Qué es, para quién, qué no hay que tocar." />
                <p className="hint">Lo verá cada revisor y entra en el prompt para tu agente.</p>
              </div>
              <div>
                <button className="btn btn-strong">Crear app</button>
              </div>
            </form>
          )}
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {projects === null && <li className="h-16 animate-pulse bg-sunken" />}
            {projects?.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Aún no tienes apps. Crea una para publicar tu primera revisión.</li>}
            {projects?.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken/60">
                  <AppMark name={p.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-[13px] text-muted">
                      {p.reviewCount != null ? plural(p.reviewCount, "revisión", "revisiones") : "Sin revisiones"} · {ROLE[p.role] ?? p.role}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
