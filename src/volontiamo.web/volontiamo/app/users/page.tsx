import Link from "next/link";

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
  const pageSize = clampPageSize(
    parsePositiveInt(readFirstQueryValue(query.pageSize), DEFAULT_PAGE_SIZE),
  );

  const volunteersResult = await readVolunteersPage({ page, pageSize });

  const activePage = volunteersResult.ok ? volunteersResult.data.page : page;
  const activePageSize = volunteersResult.ok ? volunteersResult.data.pageSize : pageSize;
  const totalCount = volunteersResult.ok ? volunteersResult.data.totalCount : 0;
  const totalPages =
    volunteersResult.ok && totalCount > 0
      ? Math.ceil(totalCount / Math.max(1, activePageSize))
      : 1;
  const hasPreviousPage = activePage > 1;
  const hasNextPage = volunteersResult.ok && activePage < totalPages;

  const rangeStart = totalCount === 0 ? 0 : (activePage - 1) * activePageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(totalCount, activePage * activePageSize);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="ambient-orb left-[-86px] top-8 h-56 w-56 bg-[var(--brand-red-glow)]" />
      <div className="ambient-orb bottom-12 right-[-58px] h-52 w-52 bg-white/55" />

      <div className="vol-shell flex min-h-screen w-full flex-col bg-[var(--shell-background)]">
        <header className="border-b border-[var(--border-subtle)] bg-white/80 px-4 py-4 backdrop-blur-xl md:px-6 lg:px-8">
          <div className="flex items-start gap-4 lg:items-center">
            <details className="mobile-nav group relative md:hidden">
              <summary className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-white/70 bg-white/90 text-[var(--text-strong)] shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
                <span className="sr-only">Apri menu</span>
                <span aria-hidden="true" className="flex flex-col gap-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-current"></span>
                  <span className="block h-0.5 w-5 rounded-full bg-current"></span>
                  <span className="block h-0.5 w-5 rounded-full bg-current"></span>
                </span>
              </summary>
              <div className="fixed inset-0 z-40 bg-[color:color-mix(in_srgb,var(--text-strong)_18%,transparent)] backdrop-blur-md"></div>
              <div className="fixed inset-y-3 left-3 z-50 flex w-[min(86vw,340px)] flex-col rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,244,236,0.94))] p-5 shadow-[var(--shell-shadow)]">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--brand-red)]">
                      LILT Padova
                    </p>
                    <p className="font-[family:var(--font-display)] text-3xl leading-none text-[var(--text-strong)]">
                      Volontiamo
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                    Menu
                  </span>
                </div>
                <nav aria-label="Navigazione mobile" className="flex flex-col gap-3">
                  <Link
                    href="/"
                    className="rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-base font-semibold text-[var(--text-strong)] shadow-[var(--panel-shadow)]"
                  >
                    Home
                  </Link>
                  <Link
                    href="/users"
                    className="rounded-xl border border-[color:rgba(255,255,255,0.18)] bg-[var(--brand-red)] px-4 py-3 text-base font-semibold text-white shadow-[var(--accent-shadow)]"
                  >
                    Volontari
                  </Link>
                </nav>
              </div>
            </details>

            <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 rounded-[26px] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(244,236,226,0.96))] px-5 py-4 shadow-[var(--panel-shadow)] ring-1 ring-white/70 sm:px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[var(--brand-red-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-red)] sm:text-[11px]">
                    Lega Italiana per la Lotta contro i Tumori
                  </span>
                  <span className="hidden h-2 w-2 rounded-full bg-[var(--brand-red)] sm:block"></span>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    /users
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="font-[family:var(--font-display)] text-4xl leading-none text-[var(--text-strong)] sm:text-5xl">
                    Volontari
                  </span>
                  <span className="pb-1 text-sm font-medium uppercase tracking-[0.18em] text-[var(--text-soft)] sm:text-base">
                    Lettura dati reale
                  </span>
                </div>
              </div>

              <div className="self-end rounded-full bg-white/88 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)] shadow-[var(--panel-shadow)] lg:self-auto">
                pagina {activePage}
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 gap-4 overflow-hidden p-3 sm:p-4 lg:gap-6 lg:p-6">
          <aside className="hidden w-[292px] shrink-0 md:flex">
            <div className="w-full rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,236,226,0.96))] p-5 shadow-[var(--panel-shadow)] ring-1 ring-white/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-red)]">
                Navigazione
              </p>
              <h2 className="mt-3 font-[family:var(--font-display)] text-[2.35rem] leading-none text-[var(--text-strong)]">
                Volontari
              </h2>

              <nav aria-label="Navigazione principale" className="mt-8 flex flex-col gap-3">
                <Link
                  href="/"
                  className="rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-base font-semibold text-[var(--text-soft)] shadow-[var(--panel-shadow)] transition hover:border-[var(--brand-red)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-strong)]"
                >
                  Home shell
                </Link>
                <Link
                  href="/users"
                  className="rounded-xl border border-[color:rgba(255,255,255,0.18)] bg-[var(--brand-red)] px-4 py-3 text-base font-semibold text-white shadow-[var(--accent-shadow)]"
                >
                  Volontari
                </Link>
              </nav>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
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
                                user.isActive
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-zinc-200 text-zinc-700"
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
          </section>
        </div>
      </div>
    </main>
  );
}
