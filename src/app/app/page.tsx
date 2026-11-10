"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/client";

type P = { id: string; name: string; role: string; revisionCount: number };

export default function Projects() {
  const [projects, setProjects] = useState<P[] | null>(null);
  const [err, setErr] = useState("");

  const load = () =>
    api<{ projects: P[] }>("/api/projects")
      .then((r) => setProjects(r.projects))
      .catch((e) => (e.status === 401 ? (location.href = "/") : setErr(e.message)));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const r = await api<{ id: string }>("/api/projects", { method: "POST", json: f });
    location.href = `/p/${r.id}`;
  }

  return (
    <>
      <TopBar>Proyectos</TopBar>
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Tus proyectos</h1>
        {err && <p className="mt-4 text-bad">{err}</p>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {projects?.map((p) => (
            <Link key={p.id} href={`/p/${p.id}`} className="card block p-5 transition hover:border-ink/40">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                <span className="chip bg-paper text-muted">{p.role}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{p.revisionCount} revisiones</p>
            </Link>
          ))}
          {projects?.length === 0 && <p className="text-muted">Aún no tienes proyectos.</p>}
        </div>
        <form onSubmit={create} className="card mt-10 max-w-xl p-5">
          <h2 className="font-semibold">Nuevo proyecto</h2>
          <label className="label mt-4" htmlFor="pn">
            Nombre
          </label>
          <input id="pn" name="name" required className="input" placeholder="App de pedidos" />
          <label className="label mt-4" htmlFor="pc">
            Contexto (opcional)
          </label>
          <textarea
            id="pc"
            name="context"
            rows={3}
            className="input"
            placeholder="Qué es la app, para quién, qué no hay que tocar…"
          />
          <button className="btn btn-primary mt-4">Crear</button>
        </form>
      </main>
    </>
  );
}
