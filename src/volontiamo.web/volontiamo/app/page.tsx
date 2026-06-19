const metrics = [
  { label: "Disponibili oggi", value: "48", tone: "warm" },
  { label: "Turni scoperti", value: "03", tone: "alert" },
  { label: "Nuovi ingressi", value: "12", tone: "calm" },
];

const rosterPreview = [
  { name: "Marina Lotti", area: "Accoglienza", shift: "08:30 - 12:30", status: "Confermato" },
  { name: "Paolo Bellini", area: "Trasporto", shift: "09:00 - 13:00", status: "In verifica" },
  { name: "Giulia Moretti", area: "Fundraising", shift: "14:00 - 18:00", status: "Confermato" },
  { name: "Fabio Zeni", area: "Front office", shift: "15:30 - 19:00", status: "Disponibile" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
      <div className="ambient-orb left-[-80px] top-8 h-56 w-56 bg-[var(--brand-red-glow)]" />
      <div className="ambient-orb bottom-14 right-[-60px] h-48 w-48 bg-white/55" />

      <div className="vol-shell mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1680px] flex-col rounded-[36px] border border-white/65 bg-[var(--shell-background)] shadow-[var(--shell-shadow)] sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-3rem)]">
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
                  <a
                    href="#"
                    className="rounded-[22px] bg-[var(--brand-red)] px-4 py-4 text-base font-semibold text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]"
                  >
                    Volontari
                  </a>
                </nav>
              </div>
            </details>

            <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="min-w-0 rounded-[26px] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(244,236,226,0.96))] px-5 py-4 shadow-[var(--panel-shadow)] ring-1 ring-white/70 sm:px-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[var(--brand-red-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-red)] sm:text-[11px]">
                      Lega Italiana per la Lotta contro i Tumori
                    </span>
                    <span className="hidden h-2 w-2 rounded-full bg-[var(--brand-red)] sm:block"></span>
                    <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Dashboard volontari
                    </span>
                  </div>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="font-[family:var(--font-display)] text-4xl leading-none text-[var(--text-strong)] sm:text-5xl">
                      Volontiamo
                    </span>
                    <span className="pb-1 text-sm font-medium uppercase tracking-[0.18em] text-[var(--text-soft)] sm:text-base">
                      Coordinamento operativo
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end lg:self-auto">
                <button
                  type="button"
                  className="hidden rounded-full bg-white/92 px-4 py-2.5 text-sm font-semibold text-[var(--text-soft)] shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5 lg:inline-flex"
                >
                  Esporta turni
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-[24px] bg-[var(--text-strong)] px-4 py-3 text-left text-white shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/16 font-semibold text-white">
                    MP
                  </span>
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                      Profilo utente
                    </span>
                    <span className="block text-base font-semibold text-white">
                      Marianna P.
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 gap-4 overflow-hidden p-3 sm:p-4 lg:gap-6 lg:p-6">
          <aside className="hidden w-[292px] shrink-0 md:flex">
            <div className="rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,236,226,0.96))] p-5 shadow-[var(--panel-shadow)] ring-1 ring-white/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-red)]">
                Navigazione
              </p>
              <h2 className="mt-3 font-[family:var(--font-display)] text-[2.35rem] leading-none text-[var(--text-strong)]">
                Volontari
              </h2>

              <nav aria-label="Navigazione principale" className="mt-8 flex flex-col gap-3">
                <a
                  href="#"
                  className="rounded-[24px] bg-[var(--text-strong)] px-5 py-4 text-base font-semibold text-white shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5"
                >
                  <span className="flex items-center justify-between gap-3">
                    Volontari
                    
                  </span>
                </a>
              </nav>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
            <div className="rounded-[34px] bg-[linear-gradient(135deg,rgba(47,42,40,0.98),rgba(87,74,67,0.94))] px-6 py-6 text-white shadow-[var(--panel-shadow)] sm:px-7 lg:px-8 lg:py-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/62">
                    Area operativa
                  </p>
                  <h1 className="mt-3 font-[family:var(--font-display)] text-5xl leading-[0.92] sm:text-[4.4rem]">
                    Coordinamento volontari, con una presenza visiva finalmente all&apos;altezza.
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-white/72 sm:text-base">
                    La shell separa navigazione, stato operativo e workspace dati con piu ritmo, meno cornici ridondanti e un tono molto piu contemporaneo.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                  {metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className={`rounded-[24px] px-4 py-4 shadow-[var(--accent-shadow)] ${
                        metric.tone === "alert"
                          ? "bg-[var(--brand-red)]"
                          : metric.tone === "warm"
                            ? "bg-white/12 ring-1 ring-white/14"
                            : "bg-white/8 ring-1 ring-white/12"
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/62">
                        {metric.label}
                      </p>
                      <p className="mt-4 text-4xl font-semibold leading-none">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[30px] bg-white/82 p-4 shadow-[var(--panel-shadow)] ring-1 ring-white/70 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-h-14 flex-1 items-center rounded-[22px] bg-[var(--surface-subtle)] px-5 text-sm text-[var(--text-soft)] shadow-[var(--inset-shadow)] sm:text-base">
                  Cerca per nome, presidio, disponibilita, stato o ultimo turno assegnato.
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    "Solo attivi",
                    "Turni scoperti",
                    "Ultimi inseriti",
                    "Disponibili weekend",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--text-soft)] shadow-[var(--panel-shadow)] ring-1 ring-[var(--border-subtle)] transition hover:-translate-y-0.5 hover:ring-[var(--brand-red)]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-h-[440px] flex-1 flex-col rounded-[34px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,236,226,0.96))] p-5 shadow-[var(--panel-shadow)] ring-1 ring-white/70 sm:min-h-[500px] lg:p-6">
              <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--brand-red)]">
                    Elenco volontari
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-3xl">
                    Workspace tabellare pronto per dati reali e azioni contestuali.
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-[var(--brand-red-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">
                    64 profili filtrati
                  </span>
                  <button
                    type="button"
                    className="rounded-full bg-[var(--text-strong)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5"
                  >
                    Nuovo volontario
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
                <div className="overflow-hidden rounded-[28px] bg-white shadow-[var(--panel-shadow)] ring-1 ring-[var(--border-subtle)]">
                  <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-3 border-b border-[var(--border-subtle)] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    <span>Volontario</span>
                    <span>Area</span>
                    <span>Turno</span>
                    <span>Stato</span>
                  </div>
                  <div>
                    {rosterPreview.map((row) => (
                      <div
                        key={row.name}
                        className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4 last:border-b-0"
                      >
                        <div>
                          <p className="font-semibold text-[var(--text-strong)]">{row.name}</p>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">Ultimo accesso 2h fa</p>
                        </div>
                        <p className="text-sm font-medium text-[var(--text-soft)]">{row.area}</p>
                        <p className="text-sm font-medium text-[var(--text-soft)]">{row.shift}</p>
                        <span
                          className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                            row.status === "Confermato"
                              ? "bg-[var(--text-strong)] text-white"
                              : row.status === "In verifica"
                                ? "bg-[var(--brand-red-soft)] text-[var(--brand-red)]"
                                : "bg-[var(--surface-subtle)] text-[var(--text-soft)]"
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="table-grid rounded-[28px] bg-[var(--surface-subtle)] p-5 shadow-[var(--inset-shadow)] ring-1 ring-[var(--border-subtle)]">
                  <div className="rounded-[24px] bg-white/90 p-5 shadow-[var(--panel-shadow)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                      Azioni contestuali
                    </p>
                    <p className="mt-3 font-[family:var(--font-display)] text-3xl leading-tight text-[var(--text-strong)]">
                      Spazio pronto per toolbar, bulk action e stati di caricamento.
                    </p>
                    <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
                      Quando arriveranno dati reali, questa area puo ospitare selezione multipla, pannello dettaglio, skeleton e messaggi di stato senza rompere il layout.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
