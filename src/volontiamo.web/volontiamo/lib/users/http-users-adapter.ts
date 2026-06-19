import "server-only";

import type {
  PagedResponse,
  VolunteerDto,
  VolunteersReadResult,
} from "@/lib/users/contracts";

const USERS_ROUTE = "/api/v1/users";
const REQUEST_TIMEOUT_MS = 10_000;
const BACKEND_PAGE_SIZE = 100;

interface ReadVolunteersInput {
  page: number;
  pageSize: number;
}

type ApiUserType = number | "Lilt" | "Volontario";

interface ApiUserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  userType: ApiUserType;
}

function readUsersApiBaseUrl(): { ok: true; value: URL } | { ok: false; message: string } {
  const baseUrlRaw = process.env.VOLONTIAMO_API_BASE_URL;
  if (!baseUrlRaw) {
    return {
      ok: false,
      message:
        "Variabile VOLONTIAMO_API_BASE_URL assente. Configura il backend base URL nel frontend.",
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

function isApiUserDto(value: unknown): value is ApiUserDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.firstName === "string" &&
    typeof value.lastName === "string" &&
    typeof value.email === "string" &&
    (typeof value.phone === "string" || value.phone === null) &&
    typeof value.isActive === "boolean" &&
    (typeof value.userType === "number" ||
      value.userType === "Lilt" ||
      value.userType === "Volontario")
  );
}

function isUsersPageEnvelope(value: unknown): value is PagedResponse<ApiUserDto> {
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

  return value.items.every((item) => isApiUserDto(item));
}

function isVolunteerType(userType: ApiUserType): boolean {
  return userType === 1 || userType === "Volontario";
}

function mapToVolunteerDto(user: ApiUserDto): VolunteerDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
  };
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

export async function readVolunteersPage(
  input: ReadVolunteersInput,
): Promise<VolunteersReadResult> {
  const baseUrlResult = readUsersApiBaseUrl();
  if (!baseUrlResult.ok) {
    return {
      ok: false,
      kind: "configuration",
      message: baseUrlResult.message,
    };
  }

  const volunteers: VolunteerDto[] = [];
  let backendPage = 1;
  let totalBackendPages = 1;

  while (backendPage <= totalBackendPages) {
    const url = new URL(USERS_ROUTE, baseUrlResult.value);
    url.searchParams.set("page", String(backendPage));
    url.searchParams.set("pageSize", String(BACKEND_PAGE_SIZE));

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "application/json",
        },
      });
    } catch {
      return {
        ok: false,
        kind: "network",
        message:
          "Backend non raggiungibile. Verifica che l'API sia avviata e VOLONTIAMO_API_BASE_URL sia corretta.",
      };
    }

    if (!response.ok) {
      const detail = await readHttpErrorMessage(response);
      const baseMessage = `Chiamata GET volontari fallita (${response.status}).`;

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
      return {
        ok: false,
        kind: "invalid-response",
        message: "Il backend ha restituito un payload non JSON.",
      };
    }

    if (!isUsersPageEnvelope(payload)) {
      return {
        ok: false,
        kind: "invalid-response",
        message: "Il payload ricevuto non rispetta il contratto paginato previsto.",
      };
    }

    const backendItems = payload.items.filter((item) => isVolunteerType(item.userType));
    volunteers.push(...backendItems.map(mapToVolunteerDto));

    totalBackendPages = Math.max(1, Math.ceil(payload.totalCount / payload.pageSize));
    backendPage += 1;
  }

  const safePage = Math.max(1, input.page);
  const safePageSize = Math.max(1, input.pageSize);
  const startIndex = (safePage - 1) * safePageSize;
  const pagedVolunteers = volunteers.slice(startIndex, startIndex + safePageSize);

  return {
    ok: true,
    data: {
      items: pagedVolunteers,
      page: safePage,
      pageSize: safePageSize,
      totalCount: volunteers.length,
    },
  };
}
