import "server-only";

import { readSessionToken } from "@/lib/auth/session";
import { isRecord, readApiBaseUrl, readHttpErrorMessage } from "@/lib/http";
import type {
  PagedResponse,
  ReadReportingLeaderboardInput,
  ReadReportingSummaryInput,
  ReportingLeaderboardEntryDto,
  ReportingReadResult,
  ReportingSummaryDto,
} from "@/lib/reports/contracts";

const REPORTS_ROUTE = "/api/v1/reports";
const REQUEST_TIMEOUT_MS = 10_000;

function isReportingSummaryDto(value: unknown): value is ReportingSummaryDto {
  return isRecord(value)
    && typeof value.totalHours === "number"
    && typeof value.concludedEventsCount === "number"
    && typeof value.volunteersCount === "number";
}

function isReportingLeaderboardEntryDto(value: unknown): value is ReportingLeaderboardEntryDto {
  return isRecord(value)
    && typeof value.userId === "string"
    && typeof value.firstName === "string"
    && typeof value.lastName === "string"
    && typeof value.totalHours === "number"
    && typeof value.participatedEventsCount === "number";
}

function isLeaderboardPage(value: unknown): value is PagedResponse<ReportingLeaderboardEntryDto> {
  return isRecord(value)
    && Array.isArray(value.items)
    && value.items.every((item) => isReportingLeaderboardEntryDto(item))
    && typeof value.page === "number"
    && typeof value.pageSize === "number"
    && typeof value.totalCount === "number";
}

function appendRangeParams(url: URL, input: ReadReportingSummaryInput): void {
  if (input.fromUtc) {
    url.searchParams.set("from", input.fromUtc);
  }

  if (input.toUtc) {
    url.searchParams.set("to", input.toUtc);
  }
}

async function fetchReports(pathname: string): Promise<Response | ReportingReadResult<never>> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const token = await readSessionToken();
  if (!token) {
    return { ok: false, kind: "http", statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  const url = new URL(pathname, baseUrlResult.value);

  try {
    return await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante la lettura della rendicontazione." };
  }
}

export async function readReportingSummary(input: ReadReportingSummaryInput): Promise<ReportingReadResult<ReportingSummaryDto>> {
  const url = new URL(`${REPORTS_ROUTE}/summary`, "http://volontiamo.local");
  appendRangeParams(url, input);

  const response = await fetchReports(`${url.pathname}${url.search}`);
  if (!(response instanceof Response)) {
    return response;
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura riepilogo rendicontazione fallita (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un riepilogo rendicontazione non JSON." };
  }

  if (!isReportingSummaryDto(payload)) {
    return { ok: false, kind: "invalid-response", message: "Il payload riepilogo rendicontazione non rispetta il contratto previsto." };
  }

  return { ok: true, data: payload };
}

export async function readReportingLeaderboard(input: ReadReportingLeaderboardInput): Promise<ReportingReadResult<PagedResponse<ReportingLeaderboardEntryDto>>> {
  const url = new URL(`${REPORTS_ROUTE}/leaderboard`, "http://volontiamo.local");
  appendRangeParams(url, input);
  url.searchParams.set("page", String(input.page));
  url.searchParams.set("pageSize", String(input.pageSize));

  const response = await fetchReports(`${url.pathname}${url.search}`);
  if (!(response instanceof Response)) {
    return response;
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura classifica rendicontazione fallita (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito una classifica rendicontazione non JSON." };
  }

  if (!isLeaderboardPage(payload)) {
    return { ok: false, kind: "invalid-response", message: "Il payload classifica rendicontazione non rispetta il contratto previsto." };
  }

  return { ok: true, data: payload };
}