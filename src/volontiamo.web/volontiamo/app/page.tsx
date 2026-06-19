import Link from "next/link";

import { AppShell } from "@/app/components/app-shell";

const metrics = [
  { label: "Disponibili oggi", value: "48", tone: "warm" },
  { label: "Turni scoperti", value: "03", tone: "alert" },
  { label: "Nuovi ingressi", value: "12", tone: "calm" },
];

export default function Home() {
  return (
    <AppShell activePath="/" title="Volontiamo" eyebrow="Dashboard">
      <div className="rounded-[34px] bg-[linear-gradient(135deg,rgba(47,42,40,0.98),rgba(87,74,67,0.94))] px-6 py-6 text-white shadow-[var(--panel-shadow)] sm:px-7 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/62">
              Area operativa
            </p>
            <h1 className="mt-3 font-[family:var(--font-display)] text-5xl leading-[0.92] sm:text-[4.4rem]">
              Coordinamento volontari.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/72 sm:text-base">
              Accesso rapido alle liste operative di volontari ed eventi, con filtri e paginazione server-side.
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Link
          href="/users"
          className="rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60 transition hover:-translate-y-0.5 hover:border-[var(--brand-red)] sm:p-7"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-red)]">
            Volontari
          </p>
          <h2 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.95] text-[var(--text-strong)]">
            Elenco operativo.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
            Consulta la lista paginata dei volontari letta dal backend.
          </p>
        </Link>

        <Link
          href="/events"
          className="rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60 transition hover:-translate-y-0.5 hover:border-[var(--brand-red)] sm:p-7"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-red)]">
            Eventi
          </p>
          <h2 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.95] text-[var(--text-strong)]">
            Programma eventi.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
            Crea, filtra e archivia logicamente gli eventi LILT.
          </p>
        </Link>
      </div>
    </AppShell>
  );
}
