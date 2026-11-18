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

const ROLE: Record<string, string> = { owner: "Owner", editor: "Editor", reviewer: "Reviewer" };

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
            Your turn
          </h1>
          <p className="mt-1 text-sm text-muted">Reviews across all your apps where the next step is yours.</p>
          <ul className="mt-5 grid gap-2">
            {items === null && <li className="h-20 animate-pulse rounded-xl bg-sunken" />}
            {items?.length === 0 && (
              <li className="card px-5 py-8 text-center text-sm text-muted">Nothing pending. When someone asks you to review, or you get feedback back, it shows up here.</li>
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
              Your apps
            </h2>
            <button className="btn btn-sm" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
              <Plus size={15} aria-hidden /> New app
            </button>
          </div>
          {creating && (
            <form onSubmit={create} className="card mt-4 grid gap-4 p-5">
              <div>
                <label className="label" htmlFor="pn">
                  Name
                </label>
                <input id="pn" name="name" required className="input" placeholder="Ordering app" autoFocus />
              </div>
              <div>
                <label className="label" htmlFor="pc">
                  About the app <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea id="pc" name="context" rows={3} className="input" placeholder="What it is, who it is for, what not to touch." />
                <p className="hint">Every reviewer sees it, and it goes into the prompt for your agent.</p>
              </div>
              <div>
                <button className="btn btn-strong">Create app</button>
              </div>
            </form>
          )}
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {projects === null && <li className="h-16 animate-pulse bg-sunken" />}
            {projects?.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No apps yet. Create one to publish your first review.</li>}
            {projects?.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken/60">
                  <AppMark name={p.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-[13px] text-muted">
                      {p.reviewCount != null ? plural(p.reviewCount, "review", "reviews") : "No reviews"} · {ROLE[p.role] ?? p.role}
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
