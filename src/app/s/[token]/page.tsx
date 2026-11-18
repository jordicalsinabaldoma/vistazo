"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/TopBar";
import { api } from "@/lib/client";

export default function GuestEntry() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ projectName: string; label: string; review: { number: number; title: string } | null } | null>(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    api(`/api/guest?token=${encodeURIComponent(token)}`).then(setInfo).catch((e) => setErr(e.message));
  }, [token]);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api("/api/guest", { method: "POST", json: { token, name } });
      location.href = r.revisionId ? `/r/${r.revisionId}` : "/";
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <Logo />
      {err ? (
        <p role="alert" className="mt-10 rounded-xl bg-badbg p-6 text-bad">
          {err}
        </p>
      ) : !info ? (
        <p className="mt-10 text-muted">Comprobando enlace…</p>
      ) : (
        <form onSubmit={enter} className="card mt-10 p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {info.review ? info.review.title : info.projectName}
          </h1>
          <p className="mt-1 text-sm text-muted">Te han invitado a revisar {info.review ? `un cambio de ${info.projectName}` : info.projectName}.</p>
          <p className="mt-4 text-sm">Puedes probarla, comentar sobre lo que veas y enviar tus comentarios. No necesitas cuenta.</p>
          <label className="label mt-6" htmlFor="gn">
            Tu nombre
          </label>
          <p className="hint -mt-1 mb-2">Se verá junto a tus comentarios.</p>
          <input id="gn" className="input" required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <button className="btn btn-primary mt-4 w-full">Empezar</button>
        </form>
      )}
    </main>
  );
}
