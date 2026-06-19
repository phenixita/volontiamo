import Link from "next/link";

import { AppShell } from "@/app/components/app-shell";
import type { VolunteerDto, VolunteersReadResult } from "@/lib/users/contracts";
import { readVolunteersPage } from "@/lib/users/http-users-adapter";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

type UsersPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
  }>;
};

function readFirstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function clampPageSize(value: number): number {
  if (value < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(value, MAX_PAGE_SIZE);
}

function formatFullName(user: VolunteerDto): string {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return fullName.length > 0 ? fullName : "Nome non disponibile";
}

function buildVolunteersHref(page: number, pageSize: number): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return `/users?${params.toString()}`;
}

function renderErrorState(error: Extract<VolunteersReadResult, { ok: false }>) {
  return (
    <div className="rounded-[30px] border border-[#f0bfc3] bg-[#fff6f7] p-6 shadow-[var(--panel-shadow)] sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">
        Errore GET volontari
      </p>
      <h2 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.94] text-[var(--text-strong)] sm:text-[2.85rem]">
        Non riesco a caricare l&apos;elenco volontari.
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">
        {error.message}
      </p>
      <div className="mt-6 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Diagnostica: {error.kind}
        {error.statusCode ? ` | HTTP ${error.statusCode}` : ""}
      </div>
    </div>
  );
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const query = await searchParams;
  const page = parsePositiveInt(readFirstQueryValue(query.page), DEFAULT_PAGE);
  const pageSize = clampPageSize(parsePositiveInt(readFirstQueryValue(query.pageSize), DEFAULT_PAGE_SIZE));

  const volunteersResult = await readVolunteersPage({ page, pageSize });

  const activePage = volunteersResult.ok ? volunteersResult.data.page : page;
  const activePageSize = volunteersResult.ok ? volunteersResult.data.pageSize : pageSize;
  const totalCount = volunteersResult.ok ? volunteersResult.data.totalCount : 0;
  const totalPages = volunteersResult.ok && totalCount > 0 ? Math.ceil(totalCount / Math.max(1, activePageSize)) : 1;
  const hasPreviousPage = activePage > 1;
  const hasNextPage = volunteersResult.ok && activePage < totalPages;

  const rangeStart = totalCount === 0 ? 0 : (activePage - 1) * activePageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(totalCount, activePage * activePageSize);

  return (
    <AppShell activePath="/users" title="Volontari" eyebrow="/users" badge={`pagina ${activePage}`}>
      {!volunteersResult.ok ? (
        renderErrorState(volunteersResult)
      ) : volunteersResult.data.items.length === 0 ? (
        <div className="rounded-[30px] border border-white/80 bg-white/90 p-6 shadow-[var(--panel-shadow)] sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">
            Nessun risultato
          </p>
          <h2 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)] sm:text-[2.85rem]">
            Nessun volontario nella pagina richiesta.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">
            Prova a cambiare pagina o page size dalla query string per riallinearti ai dati presenti nel backend.
          </p>
        </div>
      ) : (
        <div className="rounded-[30px] border border-white/75 bg-white/92 p-4 shadow-[var(--panel-shadow)] ring-1 ring-white/60 sm:p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Nome completo
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Email
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Telefono
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Stato
                  </th>
                </tr>
              </thead>
              <tbody>
                {volunteersResult.data.items.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--border-subtle)]/70 last:border-b-0">
                    <td className="px-3 py-4 text-sm font-semibold text-[var(--text-strong)]">
                      {formatFullName(user)}
                    </td>
                    <td className="px-3 py-4 text-sm text-[var(--text-soft)]">{user.email}</td>
                    <td className="px-3 py-4 text-sm text-[var(--text-soft)]">
                      {user.phone?.trim() || "Non disponibile"}
                    </td>
                    <td className="px-3 py-4 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {user.isActive ? "Attivo" : "Inattivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              elementi {rangeStart}-{rangeEnd} di {totalCount}
            </p>
            <div className="flex items-center gap-2">
              {hasPreviousPage ? (
                <Link
                  href={buildVolunteersHref(activePage - 1, activePageSize)}
                  className="rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]"
                >
                  Precedente
                </Link>
              ) : (
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Precedente
                </span>
              )}

              <span className="rounded-full bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                pagina {activePage} / {totalPages}
              </span>

              {hasNextPage ? (
                <Link
                  href={buildVolunteersHref(activePage + 1, activePageSize)}
                  className="rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]"
                >
                  Successiva
                </Link>
              ) : (
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Successiva
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
