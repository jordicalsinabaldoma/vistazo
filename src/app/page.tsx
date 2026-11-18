"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/TopBar";
import { api } from "@/lib/client";

export default function Home() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);

  useEffect(() => {
    api("/api/me").then((m) => setLogged(m.user?.name ?? null)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: f });
      location.href = "/app";
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-4 py-10 md:grid-cols-[1.3fr_1fr] md:py-20">
      <section>
        <Logo />
        <h1 className="mt-10 text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
          The visual pull request for your app.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Show every change, let people test it and comment on what they see, and take the feedback back to your agent.
        </p>
        <ol className="mt-10 grid max-w-xl gap-3 text-sm">
          {[
            ["Publish", "from your agent or a form: live link, screenshots and what to test."],
            ["Share", "with your team, or with a guest link that only opens that review."],
            ["Review", "comments on screenshots or the live site. Approving or requesting changes is explicit."],
            ["Fix", "take the feedback to your agent as a prompt you check first, and publish another version."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">
                {i + 1}
              </span>
              <span>
                <b>{t}</b> <span className="text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="self-start">
        {logged ? (
          <div className="card p-6">
            <p className="text-sm text-muted">Signed in as</p>
            <p className="mt-1 text-lg font-semibold">{logged}</p>
            <a href="/app" className="btn btn-primary mt-6 w-full">
              Go to my apps
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6">
            <div className="segmented mb-6 flex w-full" role="tablist">
              {(["login", "signup"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMode(m)}
                  role="tab"
                  aria-selected={mode === m}
                  className="flex-1 justify-center"
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            {mode === "signup" && (
              <div className="mb-4">
                <label className="label" htmlFor="name">
                  Name
                </label>
                <input id="name" name="name" className="input" required autoComplete="name" />
              </div>
            )}
            <div className="mb-4">
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" className="input" required autoComplete="email" />
            </div>
            <div className="mb-6">
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            {err && (
              <p role="alert" className="mb-4 rounded-lg bg-badbg px-3 py-2 text-sm text-bad">
                {err}
              </p>
            )}
            <button className="btn btn-primary w-full" disabled={busy}>
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
            <p className="mt-4 text-xs text-muted">
              Got a link to review something? Just open it: you don’t need an account to test and comment.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
