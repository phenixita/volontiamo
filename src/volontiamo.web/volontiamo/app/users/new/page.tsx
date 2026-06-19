import Link from "next/link";

import { AppShell } from "@/app/components/app-shell";
import { createUserAction } from "@/app/users/actions";
import { requireCurrentUser } from "@/lib/auth/session";

type NewUserPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

function readFirstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewUserPage({ searchParams }: NewUserPageProps) {
  const currentUserResult = await requireCurrentUser();
  if (!currentUserResult.ok) {
    return <div className="p-6 text-sm text-[var(--brand-red)]">{currentUserResult.message}</div>;
  }

  const query = await searchParams;
  const error = readFirstQueryValue(query.error);

  return (
    <AppShell activePath="/users" title="Nuovo utente" eyebrow="/users/new" currentUser={currentUserResult.data} badge="creazione">
      <div className="rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60 sm:p-7">
        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Scheda utente</p>
            <h1 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)] sm:text-[2.85rem]">Dati e credenziali</h1>
          </div>
          <Link href="/users" className="inline-flex justify-center rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
            Torna alla lista
          </Link>
        </div>

        {error ? <div className="mt-5 rounded-[22px] border border-[#f0bfc3] bg-[#fff6f7] px-5 py-4 text-sm font-medium text-[var(--brand-red)]">{error}</div> : null}

        <form action={createUserAction} className="mt-6 grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <TextInput name="firstName" label="Nome" required />
            <TextInput name="lastName" label="Cognome" required />
            <TextInput name="email" label="Email" type="email" required />
            <TextInput name="initialPassword" label="Password iniziale" type="password" required autoComplete="new-password" />
            <TextInput name="phone" label="Telefono" />
            <TextInput name="occupation" label="Occupazione" />
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <TextInput name="dateOfBirth" label="Data nascita" type="date" />
            <TextInput name="enrollmentDate" label="Data iscrizione" type="date" required />
            <TextInput name="endDate" label="Data fine" type="date" />
          </div>
          <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-end">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Tipo utente
              <select name="userType" defaultValue="1" className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]">
                <option value="0">Lilt</option>
                <option value="1">Volontario</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-soft)]">
              <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--brand-red)]" />
              Attivo
            </label>
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Link href="/users" className="inline-flex justify-center rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
              Annulla
            </Link>
            <button type="submit" className="rounded-full bg-[var(--brand-red)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]">
              Crea utente
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function TextInput({ name, label, type = "text", required = false, defaultValue, autoComplete }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string; autoComplete?: string }) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} autoComplete={autoComplete} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]" />
    </label>
  );
}