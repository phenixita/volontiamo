import Link from "next/link";
import ReactMarkdown from "react-markdown";

import { AppShell } from "@/app/components/app-shell";
import { deleteEventAction } from "@/app/events/actions";
import { requireCurrentUser } from "@/lib/auth/session";
import type { EventDto, EventsReadResult, ReadEventsInput } from "@/lib/events/contracts";
import { readEventsPage } from "@/lib/events/http-events-adapter";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

type EventsPageProps = {
  searchParams: Promise<{
    name?: string | string[];
    status?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    error?: string | string[];
  }>;
};

const statusLabels = {
  0: "Bozza",
  1: "Attivo",
  2: "Concluso",
} as const;

function readFirstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function clampPageSize(value: number): number {
  return Math.min(Math.max(value, 1), MAX_PAGE_SIZE);
}

function parseStatus(raw: string | undefined): ReadEventsInput["status"] {
  if (raw === "draft" || raw === "active" || raw === "concluded" || raw === "all") {
    return raw;
  }

  return "default";
}

function buildEventsHref(input: ReadEventsInput): string {
  const params = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize) });
  if (input.name?.trim()) params.set("name", input.name.trim());
  if (input.status && input.status !== "default") params.set("status", input.status);
  return `/events?${params.toString()}`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function renderErrorState(error: Extract<EventsReadResult, { ok: false }>) {
  return (
    <div className="rounded-[30px] border border-[#f0bfc3] bg-[#fff6f7] p-6 shadow-[var(--panel-shadow)] sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Errore GET eventi</p>
      <h2 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.94] text-[var(--text-strong)] sm:text-[2.85rem]">
        Non riesco a caricare l&apos;elenco eventi.
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">{error.message}</p>
      <div className="mt-6 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Diagnostica: {error.kind}{error.statusCode ? ` | HTTP ${error.statusCode}` : ""}
      </div>
    </div>
  );
}

function StatusPill({ event }: { event: EventDto }) {
  const className =
    event.status === 1
      ? "bg-emerald-100 text-emerald-700"
      : event.status === 2
        ? "bg-zinc-200 text-zinc-700"
        : "bg-amber-100 text-amber-800";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${className}`}>
      {statusLabels[event.status]}
    </span>
  );
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const query = await searchParams;
  const name = readFirstQueryValue(query.name) ?? "";
  const status = parseStatus(readFirstQueryValue(query.status));
  const page = parsePositiveInt(readFirstQueryValue(query.page), DEFAULT_PAGE);
  const pageSize = clampPageSize(parsePositiveInt(readFirstQueryValue(query.pageSize), DEFAULT_PAGE_SIZE));
  const error = readFirstQueryValue(query.error);
  const currentUserResult = await requireCurrentUser();
  if (!currentUserResult.ok) {
    return renderErrorState(currentUserResult);
  }

  const eventsResult = await readEventsPage({ name, status, page, pageSize });
  const activePage = eventsResult.ok ? eventsResult.data.page : page;
  const activePageSize = eventsResult.ok ? eventsResult.data.pageSize : pageSize;
  const totalCount = eventsResult.ok ? eventsResult.data.totalCount : 0;
  const totalPages = eventsResult.ok && totalCount > 0 ? Math.ceil(totalCount / Math.max(1, activePageSize)) : 1;
  const rangeStart = totalCount === 0 ? 0 : (activePage - 1) * activePageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(totalCount, activePage * activePageSize);

  return (
    <AppShell activePath="/events" title="Eventi" eyebrow="/events" currentUser={currentUserResult.data} badge={`pagina ${activePage}`}>
      <div className="flex flex-col gap-3 rounded-[30px] border border-white/75 bg-white/92 p-5 shadow-[var(--panel-shadow)] ring-1 ring-white/60 lg:flex-row lg:items-end lg:justify-between">
        <form action="/events" className="grid flex-1 gap-3 md:grid-cols-[minmax(180px,1fr)_180px_120px_auto] md:items-end">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Nome
            <input name="name" defaultValue={name} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]" />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Stato
            <select name="status" defaultValue={status} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]">
              <option value="default">Attivi e bozze</option>
              <option value="active">Attivi</option>
              <option value="draft">Bozze</option>
              <option value="concluded">Conclusi</option>
              <option value="all">Tutti</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Pagina
            <input name="pageSize" type="number" min="1" max="100" defaultValue={activePageSize} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]" />
          </label>
          <button type="submit" className="rounded-full bg-[var(--brand-red)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]">
            Filtra
          </button>
        </form>
        <Link href="/events/new" className="inline-flex justify-center rounded-full bg-[var(--text-strong)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5">
          Nuovo evento
        </Link>
      </div>

      {error ? (
        <div className="rounded-[22px] border border-[#f0bfc3] bg-[#fff6f7] px-5 py-4 text-sm font-medium text-[var(--brand-red)]">
          {error}
        </div>
      ) : null}

      {!eventsResult.ok ? (
        renderErrorState(eventsResult)
      ) : eventsResult.data.items.length === 0 ? (
        <div className="rounded-[30px] border border-white/80 bg-white/90 p-6 shadow-[var(--panel-shadow)] sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Nessun risultato</p>
          <h2 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)] sm:text-[2.85rem]">Nessun evento trovato.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">Modifica nome o stato per ampliare la ricerca.</p>
        </div>
      ) : (
        <div className="rounded-[30px] border border-white/75 bg-white/92 p-4 shadow-[var(--panel-shadow)] ring-1 ring-white/60 sm:p-6">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Evento</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Periodo</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Luogo</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Note</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Stato</th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {eventsResult.data.items.map((eventItem) => (
                  <tr key={eventItem.id} className="border-b border-[var(--border-subtle)]/70 align-top last:border-b-0">
                    <td className="max-w-[220px] px-3 py-4 text-sm font-semibold text-[var(--text-strong)]">{eventItem.name}</td>
                    <td className="px-3 py-4 text-sm leading-6 text-[var(--text-soft)]">
                      <span className="block">{formatDateTime(eventItem.startAtUtc)}</span>
                      <span className="block">{formatDateTime(eventItem.endAtUtc)}</span>
                    </td>
                    <td className="px-3 py-4 text-sm text-[var(--text-soft)]">{eventItem.location?.trim() || "Non indicato"}</td>
                    <td className="max-w-[300px] px-3 py-4 text-sm text-[var(--text-soft)]">
                      <div className="markdown-preview max-h-24 overflow-hidden leading-6">
                        <ReactMarkdown>{eventItem.operationalNotesMarkdown || "_Nessuna nota operativa._"}</ReactMarkdown>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm"><StatusPill event={eventItem} /></td>
                    <td className="px-3 py-4 text-sm">
                      <details className="w-36">
                        <summary className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
                          Elimina
                        </summary>
                        <form action={deleteEventAction.bind(null, eventItem.id)} className="mt-2">
                          <button type="submit" className="w-full rounded-full bg-[var(--brand-red)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[var(--accent-shadow)]">
                            Conferma
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">elementi {rangeStart}-{rangeEnd} di {totalCount}</p>
            <div className="flex flex-wrap items-center gap-2">
              {activePage > 1 ? (
                <Link href={buildEventsHref({ name, status, page: activePage - 1, pageSize: activePageSize })} className="rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">Precedente</Link>
              ) : (
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Precedente</span>
              )}
              <span className="rounded-full bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">pagina {activePage} / {totalPages}</span>
              {activePage < totalPages ? (
                <Link href={buildEventsHref({ name, status, page: activePage + 1, pageSize: activePageSize })} className="rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">Successiva</Link>
              ) : (
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Successiva</span>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}