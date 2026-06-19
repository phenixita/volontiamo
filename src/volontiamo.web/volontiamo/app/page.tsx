export default function Home() {
  return (
    <main className="min-h-screen px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1600px] flex-col rounded-[28px] border border-[var(--border-strong)] bg-[var(--shell-background)] shadow-[var(--shell-shadow)] sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-2.5rem)]">
        <header className="border-b border-[var(--border-subtle)] bg-white/92 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-4">
            <details className="mobile-nav group relative md:hidden">
              <summary className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] text-[var(--text-strong)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
                <span className="sr-only">Apri menu</span>
                <span aria-hidden="true" className="flex flex-col gap-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-current"></span>
                  <span className="block h-0.5 w-5 rounded-full bg-current"></span>
                  <span className="block h-0.5 w-5 rounded-full bg-current"></span>
                </span>
              </summary>
              <div className="fixed inset-0 z-40 bg-[color:color-mix(in_srgb,var(--text-strong)_24%,transparent)] backdrop-blur-[2px]"></div>
              <div className="fixed inset-y-3 left-3 z-50 flex w-[min(84vw,320px)] flex-col rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-4 shadow-[var(--shell-shadow)]">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-red)]">
                      LILT Padova
                    </p>
                    <p className="font-[family:var(--font-display)] text-2xl leading-none text-[var(--text-strong)]">
                      Volontiamo
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                    Menu
                  </span>
                </div>
                <nav aria-label="Navigazione mobile" className="flex flex-col gap-3">
                  <a
                    href="#"
                    className="rounded-[22px] border border-[var(--border-strong)] bg-[var(--brand-red)] px-4 py-4 text-base font-semibold text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]"
                  >
                    Volontari
                  </a>
                  <div className="rounded-[22px] border border-dashed border-[var(--border-subtle)] px-4 py-5 text-sm text-[var(--text-soft)]">
                    Spazio pronto per le prossime sezioni della web app.
                  </div>
                </nav>
              </div>
            </details>

            <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
              <div className="min-w-0 rounded-[22px] border border-[var(--border-strong)] bg-[linear-gradient(135deg,var(--surface-raised),var(--surface-subtle))] px-4 py-3 shadow-[var(--panel-shadow)] sm:px-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-red)] sm:text-xs">
                  Lega Italiana per la Lotta contro i Tumori
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="font-[family:var(--font-display)] text-3xl leading-none text-[var(--brand-red)] sm:text-4xl">
                    LILT
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)] sm:text-base">
                    Volontiamo
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="flex items-center gap-3 rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 py-3 text-left shadow-[var(--panel-shadow)] transition hover:border-[var(--brand-red)] hover:-translate-y-0.5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-red-soft)] font-semibold text-[var(--brand-red)]">
                  MP
                </span>
                <span className="hidden sm:block">
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                    Profilo utente
                  </span>
                  <span className="block text-base font-semibold text-[var(--text-strong)]">
                    Marianna P.
                  </span>
                </span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 gap-4 overflow-hidden p-3 sm:p-4 lg:gap-5 lg:p-5">
          <aside className="hidden w-[248px] shrink-0 flex-col rounded-[30px] border border-[var(--border-strong)] bg-[linear-gradient(180deg,var(--surface-raised),var(--surface-subtle))] p-4 shadow-[var(--panel-shadow)] md:flex lg:w-[272px]">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-red)]">
                Navigazione
              </p>
              <h2 className="mt-2 font-[family:var(--font-display)] text-[2.1rem] leading-none text-[var(--text-strong)]">
                Volontari
              </h2>
            </div>

            <nav aria-label="Navigazione principale" className="flex flex-col gap-3">
              <a
                href="#"
                className="rounded-[24px] border border-[var(--border-strong)] bg-[var(--brand-red)] px-4 py-4 text-base font-semibold text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]"
              >
                Volontari
              </a>
              <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] px-4 py-5 text-sm text-[var(--text-soft)]">
                Nuove aree dell&apos;app compariranno qui.
              </div>
            </nav>

            <div className="mt-auto rounded-[24px] border border-[var(--border-subtle)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                Stato shell
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                Struttura pronta per accogliere filtri, tabella e routing interno.
              </p>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col rounded-[30px] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-5 shadow-[var(--panel-shadow)] sm:p-6 lg:p-8">
            <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-red)]">
                  Area operativa
                </p>
                <h1 className="mt-2 font-[family:var(--font-display)] text-4xl leading-none text-[var(--text-strong)] sm:text-[3.1rem]">
                  Volontari
                </h1>
              </div>
              <div className="flex min-h-14 items-center rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 text-sm text-[var(--text-soft)] shadow-[var(--inset-shadow)] sm:text-base">
                Barra filtri predisposta per nome, stato, cognome e altri criteri.
              </div>
            </div>

            <div className="mt-6 flex min-h-[420px] flex-1 flex-col rounded-[32px] border border-[var(--border-strong)] bg-[linear-gradient(180deg,#ffffff,var(--surface-subtle))] p-6 shadow-[var(--inset-shadow)] sm:min-h-[480px] lg:p-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                  Contenuto futuro
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-red)]"></span>
              </div>
              <div className="grid flex-1 place-items-center rounded-[26px] border border-dashed border-[var(--border-subtle)] bg-white/70 px-6 text-center">
                <div className="max-w-xl">
                  <p className="font-[family:var(--font-display)] text-3xl leading-tight text-[var(--text-strong)] sm:text-[2.5rem]">
                    Elenco volontari tabellato
                  </p>
                  <p className="mt-4 text-base leading-7 text-[var(--text-soft)]">
                    Questa area e pronta per ricevere la tabella, le azioni contestuali e gli stati di caricamento senza dover rifare il layout principale.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
