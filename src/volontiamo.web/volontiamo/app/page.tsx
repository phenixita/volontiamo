import { AppShell } from "@/app/components/app-shell";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const currentUserResult = await requireCurrentUser();
  if (!currentUserResult.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-[560px] rounded-[30px] border border-[#f0bfc3] bg-[#fff6f7] p-6 shadow-[var(--panel-shadow)] sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Sessione</p>
          <h1 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)]">
            Accesso non disponibile.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">{currentUserResult.message}</p>
        </div>
      </main>
    );
  }

  return (
    <AppShell activePath="/" title="Volontiamo" eyebrow="Dashboard" currentUser={currentUserResult.data}>
    </AppShell>
  );
}
