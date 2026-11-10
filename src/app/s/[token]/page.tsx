"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/TopBar";
import { api } from "@/lib/client";

export default function GuestEntry() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ projectName: string; label: string } | null>(null);
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
        <p className="card mt-10 p-6 text-bad">{err}</p>
      ) : !info ? (
        <p className="mt-10 text-muted">Comprobando enlace…</p>
      ) : (
        <form onSubmit={enter} className="card mt-10 p-6">
          <p className="text-sm text-muted">Te han invitado a revisar</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{info.projectName}</h1>
          <p className="mt-4 text-sm text-muted">
            Como invitado puedes ver, probar la app y comentar. La aprobación formal la hace un usuario identificado.
          </p>
          <label className="label mt-6" htmlFor="gn">
            ¿Cómo te llamas? (se verá en tus comentarios)
          </label>
          <input id="gn" className="input" required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <button className="btn btn-primary mt-4 w-full">Entrar a la revisión</button>
        </form>
      )}
    </main>
  );
}
