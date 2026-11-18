"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Me = { user: { name: string; email: string } | null; guest: { name: string } | null };

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink">
        <span className="h-2 w-2 rounded-full bg-accent" />
      </span>
      Vistazo
    </Link>
  );
}

/** Top bar: brand, breadcrumbs (children) and session. */
export default function TopBar({ children }: { children?: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => setMe({ user: null, guest: null }));
  }, []);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4">
        <Logo href={me?.user ? "/app" : "/"} />
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-muted">
          {children}
        </nav>
        {me?.user ? (
          <div className="flex items-center gap-1 text-sm">
            <span className="hidden max-w-40 truncate px-2 text-muted md:inline">{me.user.name}</span>
            <button
              className="btn btn-quiet btn-sm"
              onClick={async () => {
                await api("/api/auth/logout", { method: "POST" });
                location.href = "/";
              }}
            >
              Sign out
            </button>
          </div>
        ) : me?.guest ? (
          <span className="chip bg-neutral text-ink">Guest: {me.guest.name}</span>
        ) : me ? (
          <Link href="/" className="btn btn-sm">
            Sign in
          </Link>
        ) : null}
      </div>
    </header>
  );
}

export function Crumb({ href, children }: { href?: string; children: React.ReactNode }) {
  return (
    <>
      <span aria-hidden className="text-field">/</span>
      {href ? (
        <Link href={href} className="truncate hover:text-ink hover:underline">
          {children}
        </Link>
      ) : (
        <span className="truncate text-ink">{children}</span>
      )}
    </>
  );
}
