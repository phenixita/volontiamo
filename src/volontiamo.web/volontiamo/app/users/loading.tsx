export default function Loading() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="ambient-orb left-[-86px] top-8 h-56 w-56 bg-[var(--brand-red-glow)]" />
      <div className="ambient-orb bottom-12 right-[-58px] h-52 w-52 bg-white/55" />

      <div className="vol-shell flex min-h-screen w-full flex-col bg-[var(--shell-background)] px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
        <div className="h-20 animate-pulse rounded-[28px] bg-white/75 shadow-[var(--panel-shadow)]" />

        <div className="mt-4 grid flex-1 gap-4 md:grid-cols-[292px_minmax(0,1fr)] lg:gap-6">
          <div className="hidden animate-pulse rounded-[32px] bg-white/75 shadow-[var(--panel-shadow)] md:block" />

          <section className="space-y-4 lg:space-y-6">
            <div className="h-56 animate-pulse rounded-[34px] bg-[linear-gradient(135deg,rgba(47,42,40,0.62),rgba(87,74,67,0.62))] shadow-[var(--panel-shadow)]" />
            <div className="space-y-3 rounded-[30px] bg-white/86 p-5 shadow-[var(--panel-shadow)]">
              <div className="h-6 w-44 animate-pulse rounded-full bg-[var(--surface-subtle)]" />
              <div className="h-14 animate-pulse rounded-2xl bg-[var(--surface-subtle)]" />
              <div className="h-14 animate-pulse rounded-2xl bg-[var(--surface-subtle)]" />
              <div className="h-14 animate-pulse rounded-2xl bg-[var(--surface-subtle)]" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
