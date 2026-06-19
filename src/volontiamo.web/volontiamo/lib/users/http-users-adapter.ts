import "server-only";

import type {
  CreateUserInput,
  PagedResponse,
  UpdateUserInput,
  UserDto,
  UserMutationResult,
  UserReadResult,
  UsersReadResult,
} from "@/lib/users/contracts";
import { readSessionToken } from "@/lib/auth/session";
import type { UserType } from "@/lib/auth/contracts";
import { isRecord, readApiBaseUrl, readHttpErrorMessage } from "@/lib/http";

const USERS_ROUTE = "/api/v1/users";
const REQUEST_TIMEOUT_MS = 10_000;

interface ReadUsersInput {
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
  dateOfBirth: string | null;
  enrollmentDate: string;
  endDate: string | null;
  isActive: boolean;
  userType: ApiUserType;
  occupation: string | null;
  createdAt: string;
  updatedAt: string;
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
    (typeof value.dateOfBirth === "string" || value.dateOfBirth === null) &&
    typeof value.enrollmentDate === "string" &&
    (typeof value.endDate === "string" || value.endDate === null) &&
    typeof value.isActive === "boolean" &&
    (typeof value.userType === "number" ||
      value.userType === "Lilt" ||
      value.userType === "Volontario") &&
    (typeof value.occupation === "string" || value.occupation === null) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
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

function mapUserType(userType: ApiUserType): UserType | null {
  if (userType === 0 || userType === "Lilt") return 0;
  if (userType === 1 || userType === "Volontario") return 1;
  return null;
}

function mapToUserDto(user: ApiUserDto): UserDto | null {
  const userType = mapUserType(user.userType);
  if (userType === null) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    enrollmentDate: user.enrollmentDate,
    endDate: user.endDate,
    isActive: user.isActive,
    userType,
    occupation: user.occupation,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function readRequiredToken() {
  const token = await readSessionToken();
  if (!token) {
    return { ok: false as const, kind: "http" as const, statusCode: 401, message: "Sessione assente. Effettua il login." };
  }

  return { ok: true as const, token };
}

function mapApiUserPayload(payload: unknown): UserDto | null {
  if (!isApiUserDto(payload)) {
    return null;
  }

  return mapToUserDto(payload);
}

function isUserDto(value: UserDto | null): value is UserDto {
  return value !== null;
}

export async function readUsersPage(input: ReadUsersInput): Promise<UsersReadResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return {
      ok: false,
      kind: "configuration",
      message: baseUrlResult.message,
    };
  }

  const tokenResult = await readRequiredToken();
  if (!tokenResult.ok) {
    return tokenResult;
  }

  const url = new URL(USERS_ROUTE, baseUrlResult.value);
  url.searchParams.set("page", String(input.page));
  url.searchParams.set("pageSize", String(input.pageSize));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${tokenResult.token}` },
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
    const baseMessage = `Chiamata GET utenti fallita (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un payload non JSON." };
  }

  if (!isUsersPageEnvelope(payload)) {
    return { ok: false, kind: "invalid-response", message: "Il payload ricevuto non rispetta il contratto paginato previsto." };
  }

  const items = payload.items.map(mapToUserDto);
  if (!items.every(isUserDto)) {
    return { ok: false, kind: "invalid-response", message: "Il payload utenti contiene un tipo utente non valido." };
  }

  return {
    ok: true,
    data: { items, page: payload.page, pageSize: payload.pageSize, totalCount: payload.totalCount },
  };
}

export async function readUserById(id: string): Promise<UserReadResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const tokenResult = await readRequiredToken();
  if (!tokenResult.ok) {
    return tokenResult;
  }

  const url = new URL(`${USERS_ROUTE}/${id}`, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${tokenResult.token}` },
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante la lettura utente." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura utente fallita (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  const payload: unknown = await response.json();
  const user = mapApiUserPayload(payload);
  if (!user) {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un utente non valido." };
  }

  return { ok: true, data: user };
}

export async function createUser(input: CreateUserInput): Promise<UserMutationResult> {
  return writeUser("POST", USERS_ROUTE, input, "Creazione utente");
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserMutationResult> {
  return writeUser("PUT", `${USERS_ROUTE}/${id}`, input, "Aggiornamento utente");
}

async function writeUser(method: "POST" | "PUT", route: string, input: CreateUserInput | UpdateUserInput, label: string): Promise<UserMutationResult> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const tokenResult = await readRequiredToken();
  if (!tokenResult.ok) {
    return tokenResult;
  }

  const url = new URL(route, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${tokenResult.token}` },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, kind: "network", message: `${label} non riuscito: backend non raggiungibile.` };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `${label} fallito (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  const payload: unknown = await response.json();
  const user = mapApiUserPayload(payload);
  if (!user) {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un utente non valido." };
  }

  return { ok: true, data: user };
}
