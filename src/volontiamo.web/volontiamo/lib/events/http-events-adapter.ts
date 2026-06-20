import "server-only";

import type {
  CreateEventInput,
  EventDetailDto,
  EventDetailReadResult,
  EventDto,
  EventMutationResult,
  EventVolunteerDto,
  EventsReadResult,
  EventStatus,
  PagedResponse,
  ReadEventsInput,
  UpdateEventInput,
} from "@/lib/events/contracts";
import { readSessionToken } from "@/lib/auth/session";
import { isRecord, readApiBaseUrl, readHttpErrorMessage } from "@/lib/http";

const EVENTS_ROUTE = "/api/v1/events";
const REQUEST_TIMEOUT_MS = 10_000;

function isEventStatus(value: unknown): value is EventStatus {
  return value === 0 || value === 1 || value === 2;
}

function isApiEventDto(value: unknown): value is EventDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    typeof value.startAtUtc === "string" &&
    typeof value.endAtUtc === "string" &&
    (typeof value.location === "string" || value.location === null) &&
    typeof value.operationalNotesMarkdown === "string" &&
    isEventStatus(value.status) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.candidataParticipantsCount === "number" &&
    typeof value.partecipaParticipantsCount === "number"
  );
}

function isApiEventVolunteerDto(value: unknown): value is EventVolunteerDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.userId === "string" &&
    typeof value.firstName === "string" &&
    typeof value.lastName === "string" &&
    typeof value.email === "string" &&
    (typeof value.phone === "string" || value.phone === null)
  );
}

function isApiEventDetailDto(value: unknown): value is EventDetailDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    typeof value.startAtUtc === "string" &&
    typeof value.endAtUtc === "string" &&
    (typeof value.location === "string" || value.location === null) &&
    typeof value.operationalNotesMarkdown === "string" &&
    isEventStatus(value.status) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.candidataParticipants) &&
    value.candidataParticipants.every((participant) => isApiEventVolunteerDto(participant)) &&
    Array.isArray(value.partecipaParticipants) &&
    value.partecipaParticipants.every((participant) => isApiEventVolunteerDto(participant)) &&
    Array.isArray(value.nonInteressataParticipants) &&
    value.nonInteressataParticipants.every((participant) => isApiEventVolunteerDto(participant)) &&
    Array.isArray(value.rifiutataParticipants) &&
    value.rifiutataParticipants.every((participant) => isApiEventVolunteerDto(participant))
  );
}

function isEventsPageEnvelope(value: unknown): value is PagedResponse<EventDto> {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !Array.isArray(value.items) ||
    typeof value.page !== "number" ||
    typeof value.pageSize !== "number" ||
    typeof value.totalCount !== "number"
  ) {
    return false;
  }

  return value.items.every((item) => isApiEventDto(item));
}

function eventStatusToQuery(status: ReadEventsInput["status"]): string | null {
  switch (status) {
    case "draft":
    case "active":
    case "concluded":
    case "all":
      return status;
    default:
      return null;
  }
}

export async function readEventsPage(input: ReadEventsInput): Promise<EventsReadResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(EVENTS_ROUTE, baseUrlResult.value);
  if (input.name?.trim()) {
    url.searchParams.set("name", input.name.trim());
  }

  const status = eventStatusToQuery(input.status);
  if (status) {
    url.searchParams.set("status", status);
  }

  url.searchParams.set("page", String(input.page));
  url.searchParams.set("pageSize", String(input.pageSize));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    return {
      ok: false,
      kind: "network",
      message: "Backend non raggiungibile. Verifica che l'API sia avviata e VOLONTIAMO_API_BASE_URL sia corretta.",
    };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Chiamata GET eventi fallita (${response.status}).`;
    return {
      ok: false,
      kind: "http",
      statusCode: response.status,
      message: detail ? `${baseMessage} ${detail}` : baseMessage,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un payload non JSON." };
  }

  if (!isEventsPageEnvelope(payload)) {
    return { ok: false, kind: "invalid-response", message: "Il payload eventi non rispetta il contratto previsto." };
  }

  return { ok: true, data: payload };
}

export async function readEventDetail(id: number): Promise<EventDetailReadResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(`${EVENTS_ROUTE}/${id}`, baseUrlResult.value);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante la lettura dettaglio evento." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura dettaglio evento fallita (${response.status}).`;
    return {
      ok: false,
      kind: "http",
      statusCode: response.status,
      message: detail ? `${baseMessage} ${detail}` : baseMessage,
    };
  }

  const payload: unknown = await response.json();
  if (!isApiEventDetailDto(payload)) {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un dettaglio evento non valido." };
  }

  return { ok: true, data: payload };
}

export async function createEvent(input: CreateEventInput): Promise<EventMutationResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(EVENTS_ROUTE, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante la creazione evento." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Creazione evento fallita (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  const payload: unknown = await response.json();
  if (!isApiEventDto(payload)) {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un evento non valido." };
  }

  return { ok: true, data: payload };
}

export async function deleteEvent(id: number): Promise<EventMutationResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(`${EVENTS_ROUTE}/${id}`, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante la cancellazione evento." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Cancellazione evento fallita (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  return { ok: true };
}

export async function updateEvent(id: number, input: UpdateEventInput): Promise<EventMutationResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(`${EVENTS_ROUTE}/${id}`, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "PUT",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante l'aggiornamento evento." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Aggiornamento evento fallito (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  return { ok: true };
}

export async function acceptCandidate(eventId: number, userId: string): Promise<EventMutationResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(`${EVENTS_ROUTE}/${eventId}/candidates/${userId}/accept`, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "PUT",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante l'accettazione candidatura." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Accettazione candidatura fallita (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  return { ok: true };
}

export async function rejectCandidate(eventId: number, userId: string): Promise<EventMutationResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(`${EVENTS_ROUTE}/${eventId}/candidates/${userId}/reject`, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "PUT",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante il rifiuto candidatura." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Rifiuto candidatura fallito (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  return { ok: true };
}

export async function undoRejectCandidate(eventId: number, userId: string): Promise<EventMutationResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(`${EVENTS_ROUTE}/${eventId}/candidates/${userId}/reject`, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante l'annullamento del rifiuto candidatura." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Annullamento rifiuto candidatura fallito (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  return { ok: true };
}