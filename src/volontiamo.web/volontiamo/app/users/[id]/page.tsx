import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/app/components/app-shell";
import { updateUserAction } from "@/app/users/actions";
import { requireCurrentUser } from "@/lib/auth/session";
import { readUserById } from "@/lib/users/http-users-adapter";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

function readFirstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EditUserPage({ params, searchParams }: EditUserPageProps) {
  const currentUserResult = await requireCurrentUser();
  if (!currentUserResult.ok) {
    return <div className="p-6 text-sm text-[var(--brand-red)]">{currentUserResult.message}</div>;
  }

  const { id } = await params;
  const userResult = await readUserById(id);
  if (!userResult.ok) {
    if (userResult.statusCode === 404) {
      notFound();
    }

    return (
      <AppShell activePath="/users" title="Modifica utente" eyebrow="/users" currentUser={currentUserResult.data}>
        <div className="rounded-[30px] border border-[#f0bfc3] bg-[#fff6f7] p-6 shadow-[var(--panel-shadow)] sm:p-7">
          <p className="text-sm font-medium text-[var(--brand-red)]">{userResult.message}</p>
        </div>
      </AppShell>
    );
  }

  const query = await searchParams;
  const error = readFirstQueryValue(query.error);
  const user = userResult.data;

  return (
    <AppShell activePath="/users" title="Modifica utente" eyebrow="/users" currentUser={currentUserResult.data} badge={user.email}>
      <div className="rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60 sm:p-7">
        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Scheda utente</p>
            <h1 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)] sm:text-[2.85rem]">Dati e password</h1>
          </div>
          <Link href="/users" className="inline-flex justify-center rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
            Torna alla lista
          </Link>
        </div>

        {error ? <div className="mt-5 rounded-[22px] border border-[#f0bfc3] bg-[#fff6f7] px-5 py-4 text-sm font-medium text-[var(--brand-red)]">{error}</div> : null}

        <form action={updateUserAction.bind(null, user.id)} className="mt-6 grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <TextInput name="firstName" label="Nome" required defaultValue={user.firstName} />
            <TextInput name="lastName" label="Cognome" required defaultValue={user.lastName} />
            <TextInput name="email" label="Email" type="email" required defaultValue={user.email} />
            <TextInput name="newPassword" label="Nuova password" type="password" autoComplete="new-password" />
            <TextInput name="phone" label="Telefono" defaultValue={user.phone ?? ""} />
            <TextInput name="occupation" label="Occupazione" defaultValue={user.occupation ?? ""} />
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <TextInput name="dateOfBirth" label="Data nascita" type="date" defaultValue={user.dateOfBirth ?? ""} />
            <TextInput name="enrollmentDate" label="Data iscrizione" type="date" required defaultValue={user.enrollmentDate} />
            <TextInput name="endDate" label="Data fine" type="date" defaultValue={user.endDate ?? ""} />
          </div>
          <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-end">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Tipo utente
              <select name="userType" defaultValue={String(user.userType)} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]">
                <option value="0">Lilt</option>
                <option value="1">Volontario</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-soft)]">
              <input name="isActive" type="checkbox" defaultChecked={user.isActive} className="h-4 w-4 accent-[var(--brand-red)]" />
              Attivo
            </label>
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Link href="/users" className="inline-flex justify-center rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
              Annulla
            </Link>
            <button type="submit" className="rounded-full bg-[var(--brand-red)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]">
              Salva modifiche
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