import Link from "next/link";

import { AppShell } from "@/app/components/app-shell";
import { requireCurrentUser } from "@/lib/auth/session";
import type { ReportingReadResult } from "@/lib/reports/contracts";
import { readReportingLeaderboard, readReportingSummary } from "@/lib/reports/http-reports-adapter";

const DEFAULT_PAGE = 1;
const PAGE_SIZE = 10;
const ROME_TIME_ZONE = "Europe/Rome";

type ReportPreset = "current-year" | "current-month" | "custom";

type ReportsPageProps = {
  searchParams: Promise<{
    preset?: string | string[];
    fromDate?: string | string[];
    toDate?: string | string[];
    page?: string | string[];
  }>;
};

type RangeResolution = {
  preset: ReportPreset;
  fromDate: string;
  toDate: string;
  fromUtc: string;
  toUtc: string;
  label: string;
  warning?: string;
};

function readFirstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePreset(raw: string | undefined): ReportPreset {
  if (raw === "current-month" || raw === "custom") {
    return raw;
  }

  return "current-year";
}

function formatRomeDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function parseDateOnly(raw: string | undefined): { year: number; month: number; day: number } | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = raw.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > lastDay) {
    return null;
  }

  return { year, month, day };
}

function getRomeOffsetMinutes(utcDate: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME_TIME_ZONE,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });
  const zone = formatter.formatToParts(utcDate).find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = zone.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * ((hours * 60) + minutes);
}

function toUtcIsoForRomeDate(date: { year: number; month: number; day: number }, boundary: "start" | "end"): string {
  const hour = boundary === "start" ? 0 : 23;
  const minute = boundary === "start" ? 0 : 59;
  const second = boundary === "start" ? 0 : 59;
  const millisecond = boundary === "start" ? 0 : 999;

  const guessUtc = new Date(Date.UTC(date.year, date.month - 1, date.day, hour, minute, second, millisecond));
  const offsetMinutes = getRomeOffsetMinutes(guessUtc);
  return new Date(guessUtc.getTime() - (offsetMinutes * 60_000)).toISOString();
}

function resolveRange(preset: ReportPreset, fromDateRaw: string | undefined, toDateRaw: string | undefined, now: Date): RangeResolution {
  const todayInRome = parseDateOnly(formatRomeDate(now));
  if (!todayInRome) {
    throw new Error("Impossibile determinare la data corrente in Europe/Rome.");
  }

  if (preset === "current-month") {
    const monthStart = { year: todayInRome.year, month: todayInRome.month, day: 1 };
    const monthEnd = {
      year: todayInRome.year,
      month: todayInRome.month,
      day: new Date(Date.UTC(todayInRome.year, todayInRome.month, 0)).getUTCDate(),
    };

    return {
      preset,
      fromDate: `${monthStart.year}-${String(monthStart.month).padStart(2, "0")}-01`,
      toDate: `${monthEnd.year}-${String(monthEnd.month).padStart(2, "0")}-${String(monthEnd.day).padStart(2, "0")}`,
      fromUtc: toUtcIsoForRomeDate(monthStart, "start"),
      toUtc: toUtcIsoForRomeDate(monthEnd, "end"),
      label: "Mese corrente",
    };
  }

  if (preset === "custom") {
    const fromDate = parseDateOnly(fromDateRaw);
    const toDate = parseDateOnly(toDateRaw);

    if (fromDate && toDate) {
      const fromKey = `${fromDate.year}${String(fromDate.month).padStart(2, "0")}${String(fromDate.day).padStart(2, "0")}`;
      const toKey = `${toDate.year}${String(toDate.month).padStart(2, "0")}${String(toDate.day).padStart(2, "0")}`;
      if (fromKey <= toKey) {
        return {
          preset,
          fromDate: `${fromDate.year}-${String(fromDate.month).padStart(2, "0")}-${String(fromDate.day).padStart(2, "0")}`,
          toDate: `${toDate.year}-${String(toDate.month).padStart(2, "0")}-${String(toDate.day).padStart(2, "0")}`,
          fromUtc: toUtcIsoForRomeDate(fromDate, "start"),
          toUtc: toUtcIsoForRomeDate(toDate, "end"),
          label: "Intervallo personalizzato",
        };
      }
    }
  }

  const yearStart = { year: todayInRome.year, month: 1, day: 1 };
  const yearEnd = { year: todayInRome.year, month: 12, day: 31 };
  return {
    preset: "current-year",
    fromDate: `${todayInRome.year}-01-01`,
    toDate: `${todayInRome.year}-12-31`,
    fromUtc: toUtcIsoForRomeDate(yearStart, "start"),
    toUtc: toUtcIsoForRomeDate(yearEnd, "end"),
    label: "Anno corrente",
    warning: preset === "custom"
      ? "Intervallo personalizzato non valido. Ho ripristinato l'anno corrente."
      : undefined,
  };
}

function buildReportsHref(range: RangeResolution, page: number): string {
  const params = new URLSearchParams({
    preset: range.preset,
    fromDate: range.fromDate,
    toDate: range.toDate,
    page: String(page),
  });

  return `/reports?${params.toString()}`;
}

function formatHours(hours: number): string {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(hours);
}

function renderErrorState(error: Extract<ReportingReadResult<unknown>, { ok: false }>) {
  return (
    <div className="rounded-[30px] border border-[#f0bfc3] bg-[#fff6f7] p-6 shadow-[var(--panel-shadow)] sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Errore reporting</p>
      <h2 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.94] text-[var(--text-strong)] sm:text-[2.85rem]">
        Non riesco a caricare la rendicontazione.
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">{error.message}</p>
      <div className="mt-6 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Diagnostica: {error.kind}{error.statusCode ? ` | HTTP ${error.statusCode}` : ""}
      </div>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const query = await searchParams;
  const preset = parsePreset(readFirstQueryValue(query.preset));
  const activePage = parsePositiveInt(readFirstQueryValue(query.page), DEFAULT_PAGE);
  const range = resolveRange(preset, readFirstQueryValue(query.fromDate), readFirstQueryValue(query.toDate), new Date());

  const currentUserResult = await requireCurrentUser();
  if (!currentUserResult.ok) {
    return renderErrorState(currentUserResult);
  }

  if (currentUserResult.data.userType !== 0) {
    return (
      <AppShell activePath="/reports" title="Rendicontazione" eyebrow="/reports" currentUser={currentUserResult.data}>
        <div className="rounded-[30px] border border-[#f0bfc3] bg-[#fff6f7] p-6 shadow-[var(--panel-shadow)] sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Accesso negato</p>
          <h2 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)] sm:text-[2.85rem]">
            La rendicontazione e riservata al personale LILT.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">
            Questo pannello mostra ore aggregate, eventi conclusi e classifica nominativa dei volontari.
          </p>
        </div>
      </AppShell>
    );
  }

  const [summaryResult, leaderboardResult] = await Promise.all([
    readReportingSummary({ fromUtc: range.fromUtc, toUtc: range.toUtc }),
    readReportingLeaderboard({ fromUtc: range.fromUtc, toUtc: range.toUtc, page: activePage, pageSize: PAGE_SIZE }),
  ]);

  const totalCount = leaderboardResult.ok ? leaderboardResult.data.totalCount : 0;
  const totalPages = leaderboardResult.ok && totalCount > 0 ? Math.ceil(totalCount / leaderboardResult.data.pageSize) : 1;
  const rangeStart = totalCount === 0 ? 0 : (activePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(totalCount, activePage * PAGE_SIZE);

  return (
    <AppShell activePath="/reports" title="Rendicontazione" eyebrow="/reports" currentUser={currentUserResult.data}>
      <div className="flex flex-col gap-3 rounded-[30px] border border-white/75 bg-white/92 p-5 shadow-[var(--panel-shadow)] ring-1 ring-white/60 lg:flex-row lg:items-end lg:justify-between">
        <form action="/reports" className="grid flex-1 gap-3 md:grid-cols-[180px_1fr_1fr_auto] md:items-end">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Vista
            <select name="preset" defaultValue={range.preset} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]">
              <option value="current-year">Anno corrente</option>
              <option value="current-month">Mese corrente</option>
              <option value="custom">Intervallo personalizzato</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Dal
            <input name="fromDate" type="date" defaultValue={range.fromDate} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]" />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Al
            <input name="toDate" type="date" defaultValue={range.toDate} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[var(--text-strong)]" />
          </label>
          <button type="submit" className="rounded-full bg-[var(--brand-red)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]">
            Aggiorna
          </button>
        </form>

        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-soft)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">Intervallo attivo</p>
          <p className="mt-1 font-semibold text-[var(--text-strong)]">{range.label}</p>
          <p className="mt-1">{range.fromDate} → {range.toDate}</p>
        </div>
      </div>

      {range.warning ? (
        <div className="rounded-[22px] border border-[#f4d7a4] bg-[#fff9ee] px-5 py-4 text-sm font-medium text-[#93611d]">
          {range.warning}
        </div>
      ) : null}

      {!summaryResult.ok ? renderErrorState(summaryResult) : !leaderboardResult.ok ? renderErrorState(leaderboardResult) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-[30px] border border-white/75 bg-[linear-gradient(135deg,rgba(214,32,42,0.96),rgba(184,22,34,0.98))] p-6 text-white shadow-[var(--accent-shadow)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/78">Ore donate</p>
              <p className="mt-5 font-[family:var(--font-display)] text-5xl leading-none">{formatHours(summaryResult.data.totalHours)}</p>
              <p className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-white/80">somma durata × presenze accettate</p>
            </article>

            <article className="rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Eventi conclusi</p>
              <p className="mt-5 font-[family:var(--font-display)] text-5xl leading-none text-[var(--text-strong)]">{summaryResult.data.concludedEventsCount}</p>
              <p className="mt-3 text-sm text-[var(--text-soft)]">Eventi conclusi nel periodo selezionato.</p>
            </article>

            <article className="rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Volontari attivi</p>
              <p className="mt-5 font-[family:var(--font-display)] text-5xl leading-none text-[var(--text-strong)]">{summaryResult.data.volunteersCount}</p>
              <p className="mt-3 text-sm text-[var(--text-soft)]">Volontari con almeno una presenza accettata negli eventi conclusi selezionati.</p>
            </article>
          </div>

          <div className="rounded-[30px] border border-white/75 bg-white/92 p-5 shadow-[var(--panel-shadow)] ring-1 ring-white/60 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Leaderboard</p>
                <h2 className="mt-2 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)] sm:text-[2.65rem]">Volontari per ore donate</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">Classifica ordinata per ore donate, poi per numero di eventi conclusi a cui il volontario ha partecipato.</p>
              </div>
              <div className="rounded-full bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                elementi {rangeStart}-{rangeEnd} di {totalCount}
              </div>
            </div>

            {leaderboardResult.data.items.length === 0 ? (
              <div className="mt-6 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-6 text-sm text-[var(--text-soft)]">
                Nessun volontario con ore rendicontabili nell&apos;intervallo selezionato.
              </div>
            ) : (
              <>
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-[720px] border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-left">
                        <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Pos.</th>
                        <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Volontario</th>
                        <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Ore</th>
                        <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Eventi conclusi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardResult.data.items.map((item, index) => {
                        const rank = ((leaderboardResult.data.page - 1) * leaderboardResult.data.pageSize) + index + 1;

                        return (
                          <tr key={item.userId} className="border-b border-[var(--border-subtle)]/70 last:border-b-0">
                            <td className="px-3 py-4 text-sm font-semibold text-[var(--brand-red)]">#{rank}</td>
                            <td className="px-3 py-4 text-sm text-[var(--text-strong)]">
                              <span className="font-semibold">{item.firstName} {item.lastName}</span>
                            </td>
                            <td className="px-3 py-4 text-sm font-semibold text-[var(--text-strong)]">{formatHours(item.totalHours)}</td>
                            <td className="px-3 py-4 text-sm text-[var(--text-soft)]">{item.participatedEventsCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">pagina {leaderboardResult.data.page} / {totalPages}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {leaderboardResult.data.page > 1 ? (
                      <Link href={buildReportsHref(range, leaderboardResult.data.page - 1)} className="rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">Precedente</Link>
                    ) : (
                      <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Precedente</span>
                    )}
                    {leaderboardResult.data.page < totalPages ? (
                      <Link href={buildReportsHref(range, leaderboardResult.data.page + 1)} className="rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">Successiva</Link>
                    ) : (
                      <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Successiva</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}