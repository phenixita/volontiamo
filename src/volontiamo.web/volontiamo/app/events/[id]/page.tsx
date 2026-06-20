import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { AppShell } from "@/app/components/app-shell";
import { acceptCandidateAction, deleteEventAction, deleteParticipationAction, rejectCandidateAction } from "@/app/events/actions";
import { requireCurrentUser } from "@/lib/auth/session";
import type { EventDetailDto, EventVolunteerDto } from "@/lib/events/contracts";
import { readEventDetail } from "@/lib/events/http-events-adapter";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

const statusLabels = {
  0: "Bozza",
  1: "Attivo",
  2: "Concluso",
} as const;

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

function parseId(rawId: string): number | null {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id) || id < 1) {
    return null;
  }

  return id;
}

function StatusPill({ event }: { event: EventDetailDto }) {
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

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const currentUserResult = await requireCurrentUser();
  if (!currentUserResult.ok) {
    return <div className="p-6 text-sm text-[var(--brand-red)]">{currentUserResult.message}</div>;
  }

  const { id } = await params;
  const eventId = parseId(id);
  if (!eventId) {
    notFound();
  }

  const detailResult = await readEventDetail(eventId);
  if (!detailResult.ok) {
    if (detailResult.statusCode === 404) {
      notFound();
    }

    return (
      <AppShell activePath="/events" title="Dettaglio evento" eyebrow="/events" currentUser={currentUserResult.data}>
        <div className="rounded-[30px] border border-[#f0bfc3] bg-[#fff6f7] p-6 shadow-[var(--panel-shadow)] sm:p-7">
          <p className="text-sm font-medium text-[var(--brand-red)]">{detailResult.message}</p>
        </div>
      </AppShell>
    );
  }

  const eventDetail = detailResult.data;

  return (
    <AppShell activePath="/events" title="Dettaglio evento" eyebrow="/events" currentUser={currentUserResult.data} badge={`evento #${eventDetail.id}`}>
      <div className="rounded-[30px] border border-white/75 bg-white/92 p-6 shadow-[var(--panel-shadow)] ring-1 ring-white/60 sm:p-7">
        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-red)]">Evento #{eventDetail.id}</p>
            <h1 className="mt-3 font-[family:var(--font-display)] text-4xl leading-[0.96] text-[var(--text-strong)] sm:text-[2.85rem]">{eventDetail.name}</h1>
          </div>
          <Link href="/events" className="inline-flex justify-center rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
            Torna alla lista
          </Link>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Inizio" value={formatDateTime(eventDetail.startAtUtc)} />
          <InfoCard label="Fine" value={formatDateTime(eventDetail.endAtUtc)} />
          <InfoCard label="Luogo" value={eventDetail.location?.trim() || "Non indicato"} />
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Stato</p>
            <div className="mt-2"><StatusPill event={eventDetail} /></div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Candidata</p>
              <p className="mt-2 text-2xl font-[family:var(--font-display)] text-[var(--text-strong)]">{eventDetail.candidataParticipants.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Partecipa</p>
              <p className="mt-2 text-2xl font-[family:var(--font-display)] text-[var(--text-strong)]">{eventDetail.partecipaParticipants.length}</p>
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-white px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Note operative</p>
          <div className="markdown-preview mt-3 text-sm leading-7 text-[var(--text-soft)]">
            <ReactMarkdown>{eventDetail.operationalNotesMarkdown || "_Nessuna nota operativa._"}</ReactMarkdown>
          </div>
        </section>

        <ParticipantsSection
          title="Candidata"
          emptyMessage="Nessuna candidatura aperta per questo evento."
          participants={eventDetail.candidataParticipants}
          actionsLabel="Gestisci candidatura"
          actions={(participant) => (
            <div className="flex flex-wrap gap-2">
              <form action={acceptCandidateAction.bind(null, eventDetail.id, participant.userId)}>
                <button type="submit" className="rounded-full bg-[var(--brand-red)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[var(--brand-red-deep)]">
                  Accetta
                </button>
              </form>
              <form action={rejectCandidateAction.bind(null, eventDetail.id, participant.userId)}>
                <button type="submit" className="rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
                  Rifiuta
                </button>
              </form>
              <DeleteParticipationControl
                action={deleteParticipationAction.bind(null, eventDetail.id, participant.userId)}
                volunteerName={`${participant.firstName} ${participant.lastName}`}
              />
            </div>
          )}
        />

        <ParticipantsSection
          title="Partecipa"
          emptyMessage="Nessun volontario confermato per questo evento."
          participants={eventDetail.partecipaParticipants}
          actionsLabel="Rimuovi partecipazione"
          actions={(participant) => (
            <DeleteParticipationControl
              action={deleteParticipationAction.bind(null, eventDetail.id, participant.userId)}
              volunteerName={`${participant.firstName} ${participant.lastName}`}
            />
          )}
        />

        <ParticipantsSection
          title="Non interessati"
          emptyMessage="Nessun volontario ha escluso questo evento."
          participants={eventDetail.nonInteressataParticipants}
          actionsLabel="Rimuovi stato"
          actions={(participant) => (
            <DeleteParticipationControl
              action={deleteParticipationAction.bind(null, eventDetail.id, participant.userId)}
              volunteerName={`${participant.firstName} ${participant.lastName}`}
            />
          )}
        />

        <ParticipantsSection
          title="Rifiutate"
          emptyMessage="Nessuna candidatura rifiutata per questo evento."
          participants={eventDetail.rifiutataParticipants}
          actionsLabel="Rimuovi rifiuto"
          actions={(participant) => (
            <DeleteParticipationControl
              action={deleteParticipationAction.bind(null, eventDetail.id, participant.userId)}
              volunteerName={`${participant.firstName} ${participant.lastName}`}
            />
          )}
        />

        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Link href={`/events/${eventDetail.id}/edit`} className="inline-flex justify-center rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
            Modifica
          </Link>
          <details>
            <summary className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
              Elimina evento
            </summary>
            <form action={deleteEventAction.bind(null, eventDetail.id)} className="mt-3">
              <button type="submit" className="rounded-full bg-[var(--brand-red)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[var(--accent-shadow)] transition hover:bg-[var(--brand-red-deep)]">
                Conferma eliminazione
              </button>
            </form>
          </details>
        </div>
      </div>
    </AppShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-sm text-[var(--text-soft)]">{value}</p>
    </div>
  );
}

function ParticipantsSection({
  title,
  emptyMessage,
  participants,
  actionsLabel,
  actions,
}: {
  title: string;
  emptyMessage: string;
  participants: EventVolunteerDto[];
  actionsLabel: string;
  actions?: (participant: EventVolunteerDto) => React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-white px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</p>
      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-soft)]">{emptyMessage}</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left">
                  <th className="px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Nome</th>
                  <th className="px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Cognome</th>
                  <th className="px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Email</th>
                  <th className="px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Telefono</th>
                  <th className="px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => (
                  <tr key={participant.userId} className="border-b border-[var(--border-subtle)]/70 last:border-b-0">
                    <td className="px-2 py-3 text-sm font-semibold text-[var(--text-strong)]">{participant.firstName}</td>
                    <td className="px-2 py-3 text-sm text-[var(--text-soft)]">{participant.lastName}</td>
                    <td className="px-2 py-3 text-sm text-[var(--text-soft)]">{participant.email}</td>
                    <td className="px-2 py-3 text-sm text-[var(--text-soft)]">{participant.phone?.trim() || "Non disponibile"}</td>
                    <td className="px-2 py-3 text-sm text-[var(--text-soft)]">{actions(participant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:hidden">
            {participants.map((participant) => (
              <article key={participant.userId} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-strong)]">{participant.firstName} {participant.lastName}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">{participant.email}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">{participant.phone?.trim() || "Non disponibile"}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{actionsLabel}</p>
                  <div className="mt-3">{actions(participant)}</div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DeleteParticipationControl({
  action,
  volunteerName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  volunteerName: string;
}) {
  return (
    <details className="group inline-block">
      <summary className="list-none cursor-pointer rounded-full border border-[var(--border-subtle)] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]">
        <span className="inline-flex items-center gap-2">
          <TrashIcon />
          <span>Elimina</span>
        </span>
      </summary>
      <div className="mt-2 w-full min-w-[15rem] rounded-2xl border border-[var(--border-subtle)] bg-white p-3 shadow-[var(--panel-shadow)] sm:w-auto">
        <p className="text-sm text-[var(--text-soft)]">Confermi la rimozione di {volunteerName} da questo evento?</p>
        <form action={action} className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="rounded-full bg-[var(--brand-red)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[var(--brand-red-deep)]">
            Conferma
          </button>
        </form>
      </div>
    </details>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}
