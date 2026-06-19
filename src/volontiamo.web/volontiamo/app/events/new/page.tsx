import Link from "next/link";

import { AppShell } from "@/app/components/app-shell";
import { createEventAction } from "@/app/events/actions";

type NewEventPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

function readFirstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewEventPage({ searchParams }: NewEventPageProps) {
  const query = await searchParams;
  const error = readFirstQueryValue(query.error);

  return (
    <AppShell activePath="/events" title="Nuovo evento" eyebrow="/events/new" badge="creazione">
      <div className="rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60 sm:p-7">
        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Scheda evento</p>
            <h1 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)] sm:text-[2.85rem]">Dati operativi</h1>
          </div>
          <Link href="/events" className="inline-flex justify-center rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
            Torna alla lista
          </Link>
        </div>

        {error ? (
          <div className="mt-5 rounded-[22px] border border-[#f0bfc3] bg-[#fff6f7] px-5 py-4 text-sm font-medium text-[var(--brand-red)]">
            {error}
          </div>
        ) : null}

        <form action={createEventAction} className="mt-6 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(220px,1fr)_220px]">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Nome evento
              <input name="name" required maxLength={200} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]" />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Stato
              <select name="status" defaultValue="0" className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]">
                <option value="0">Bozza</option>
                <option value="1">Attivo</option>
                <option value="2">Concluso</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <fieldset className="grid gap-3 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
              <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Inizio Europe/Rome</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="startDate" type="date" required className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)]" />
                <input name="startTime" type="time" required className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)]" />
              </div>
            </fieldset>
            <fieldset className="grid gap-3 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
              <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Fine Europe/Rome</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="endDate" type="date" required className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)]" />
                <input name="endTime" type="time" required className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm text-[var(--text-strong)]" />
              </div>
            </fieldset>
          </div>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Luogo
            <input name="location" maxLength={300} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]" />
          </label>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Note operative Markdown
            <textarea name="operationalNotesMarkdown" rows={12} className="resize-y rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 font-mono text-sm normal-case tracking-normal text-[var(--text-strong)]" />
          </label>

          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Link href="/events" className="inline-flex justify-center rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
              Annulla
            </Link>
            <button type="submit" className="rounded-full bg-[var(--brand-red)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]">
              Crea evento
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}