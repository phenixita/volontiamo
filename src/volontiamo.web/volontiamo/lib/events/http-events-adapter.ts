import "server-only";

import type {
  CreateEventInput,
  EventDto,
  EventMutationResult,
  EventsReadResult,
  EventStatus,
  PagedResponse,
  ReadEventsInput,
} from "@/lib/events/contracts";

const EVENTS_ROUTE = "/api/v1/events";
const REQUEST_TIMEOUT_MS = 10_000;

function readEventsApiBaseUrl(): { ok: true; value: URL } | { ok: false; message: string } {
  const baseUrlRaw = process.env.VOLONTIAMO_API_BASE_URL;
  if (!baseUrlRaw) {
    return {
      ok: false,
      message: "Variabile VOLONTIAMO_API_BASE_URL assente. Configura il backend base URL nel frontend.",
    };
  }

  try {
    const parsed = new URL(baseUrlRaw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        ok: false,
        message: "VOLONTIAMO_API_BASE_URL deve usare protocollo http:// o https://.",
      };
    }

    return { ok: true, value: parsed };
  } catch {
    return {
      ok: false,
      message: "VOLONTIAMO_API_BASE_URL non e un URL valido.",
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
    typeof value.updatedAt === "string"
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

async function readHttpErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      if (isRecord(payload)) {
        const detail = payload.detail;
        const title = payload.title;

        if (typeof detail === "string" && detail.length > 0) {
          return detail;
        }

        if (typeof title === "string" && title.length > 0) {
          return title;
        }
      }
    } else {
      const text = (await response.text()).trim();
      if (text.length > 0) {
        return text;
      }
    }
  } catch {
    return null;
  }

  return null;
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
  const baseUrlResult = readEventsApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
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
      headers: { Accept: "application/json" },
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

export async function createEvent(input: CreateEventInput): Promise<EventMutationResult> {
  const baseUrlResult = readEventsApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const url = new URL(EVENTS_ROUTE, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
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
  const baseUrlResult = readEventsApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const url = new URL(`${EVENTS_ROUTE}/${id}`, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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