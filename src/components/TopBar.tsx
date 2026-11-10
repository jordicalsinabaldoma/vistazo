"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Me = { user: { name: string; email: string } | null; guest: { name: string } | null };

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink">
        <span className="h-2 w-2 rounded-full bg-accent" />
      </span>
      Vistazo
    </Link>
  );
}

export default function TopBar({ children }: { children?: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => setMe({ user: null, guest: null }));
  }, []);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-4 px-4">
        <Logo />
        <div className="min-w-0 flex-1 truncate text-sm text-muted">{children}</div>
        {me?.user ? (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/app" className="hover:underline">
              Proyectos
            </Link>
            <span className="hidden text-muted sm:inline">{me.user.name}</span>
            <button
              className="btn btn-ghost"
              onClick={async () => {
                await api("/api/auth/logout", { method: "POST" });
                location.href = "/";
              }}
            >
              Salir
            </button>
          </div>
        ) : me?.guest ? (
          <span className="chip bg-warnbg text-warn">Invitado: {me.guest.name}</span>
        ) : me ? (
          <Link href="/" className="btn">
            Entrar
          </Link>
        ) : null}
      </div>
    </header>
  );
}
