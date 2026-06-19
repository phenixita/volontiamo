import Link from "next/link";

import { logoutAction } from "@/app/login/actions";
import type { AuthenticatedUserDto } from "@/lib/auth/contracts";
import { formatUserType } from "@/lib/auth/contracts";

type AppShellProps = {
  activePath: "/" | "/users" | "/events";
  title: string;
  eyebrow: string;
  currentUser: AuthenticatedUserDto;
  badge?: string;
  children: React.ReactNode;
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/users", label: "Utenti" },
  { href: "/events", label: "Eventi" },
] as const;

function navClass(isActive: boolean): string {
  return isActive
    ? "rounded-xl border border-[color:rgba(255,255,255,0.18)] bg-[var(--brand-red)] px-4 py-3 text-base font-semibold text-white shadow-[var(--accent-shadow)]"
    : "rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-base font-semibold text-[var(--text-soft)] shadow-[var(--panel-shadow)] transition hover:border-[var(--brand-red)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-strong)]";
}

function formatFullName(user: AuthenticatedUserDto): string {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return fullName || user.email;
}

export function AppShell({ activePath, title, eyebrow, currentUser, badge, children }: AppShellProps) {
  const activeItem = navItems.find((item) => item.href === activePath) ?? navItems[0];

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
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </span>
              </summary>
              <div className="fixed inset-0 z-40 bg-[color:color-mix(in_srgb,var(--text-strong)_18%,transparent)] backdrop-blur-md" />
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
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href} className={navClass(item.href === activePath)}>
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </details>

            <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 rounded-[26px] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(244,236,226,0.96))] px-5 py-4 shadow-[var(--panel-shadow)] ring-1 ring-white/70 sm:px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[var(--brand-red-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-red)] sm:text-[11px]">
                    Lega Italiana per la Lotta contro i Tumori
                  </span>
                  <span className="hidden h-2 w-2 rounded-full bg-[var(--brand-red)] sm:block" />
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {eyebrow}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <span className="font-[family:var(--font-display)] text-4xl leading-none text-[var(--text-strong)] sm:text-5xl">
                    {title}
                  </span>
                  <span className="pb-1 text-sm font-medium uppercase tracking-[0.18em] text-[var(--text-soft)] sm:text-base">
                    Coordinamento operativo
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 self-end lg:self-auto">
                <div className="rounded-[22px] border border-white/75 bg-white/88 px-4 py-3 text-right shadow-[var(--panel-shadow)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
                    {formatUserType(currentUser.userType)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{formatFullName(currentUser)}</p>
                  <p className="mt-1 max-w-[260px] truncate text-xs text-[var(--text-muted)]">{currentUser.email}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {badge ? (
                    <div className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)] shadow-[var(--panel-shadow)]">
                      {badge}
                    </div>
                  ) : null}
                  <form action={logoutAction}>
                    <button type="submit" className="rounded-full border border-[var(--border-subtle)] bg-white/88 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)] shadow-[var(--panel-shadow)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
                      Esci
                    </button>
                  </form>
                </div>
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
                {activeItem.label}
              </h2>

              <nav aria-label="Navigazione principale" className="mt-8 flex flex-col gap-3">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className={navClass(item.href === activePath)}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <section className="relative z-10 flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}