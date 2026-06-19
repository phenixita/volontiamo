import { redirect } from "next/navigation";

import { loginAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth/http-auth-adapter";
import { readSessionToken } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

function readFirstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const token = await readSessionToken();
  if (token) {
    const currentUser = await getCurrentUser(token);
    if (currentUser.ok) {
      redirect("/");
    }
  }

  const query = await searchParams;
  const error = readFirstQueryValue(query.error);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px] rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-red)]">
          LILT Padova
        </p>
        <h1 className="mt-3 font-[family:var(--font-display)] text-5xl leading-none text-[var(--text-strong)]">
          Volontiamo
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
          Accedi con email e password per entrare nel backoffice operativo.
        </p>

        {error ? (
          <div className="mt-5 rounded-[22px] border border-[#f0bfc3] bg-[#fff6f7] px-5 py-4 text-sm font-medium text-[var(--brand-red)]">
            {error}
          </div>
        ) : null}

        <form action={loginAction} className="mt-6 grid gap-5">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]"
            />
          </label>
          <button type="submit" className="rounded-full bg-[var(--brand-red)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]">
            Accedi
          </button>
        </form>
      </div>
    </main>
  );
}