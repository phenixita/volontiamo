import "server-only";

import type { AuthenticatedUserDto, AuthResult, LoginSuccess, UserType } from "@/lib/auth/contracts";
import { isRecord, readApiBaseUrl, readHttpErrorMessage } from "@/lib/http";

const LOGIN_ROUTE = "/api/v1/auth/login";
const ME_ROUTE = "/api/v1/auth/me";
const REQUEST_TIMEOUT_MS = 10_000;

type ApiUserType = number | "Lilt" | "Volontario";

function mapUserType(userType: ApiUserType): UserType | null {
  if (userType === 0 || userType === "Lilt") return 0;
  if (userType === 1 || userType === "Volontario") return 1;
  return null;
}

function isApiAuthenticatedUser(value: unknown): value is Omit<AuthenticatedUserDto, "userType"> & { userType: ApiUserType } {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.firstName === "string" &&
    typeof value.lastName === "string" &&
    typeof value.email === "string" &&
    typeof value.isActive === "boolean" &&
    (typeof value.userType === "number" || value.userType === "Lilt" || value.userType === "Volontario")
  );
}

function mapAuthenticatedUser(value: unknown): AuthenticatedUserDto | null {
  if (!isApiAuthenticatedUser(value)) {
    return null;
  }

  const userType = mapUserType(value.userType);
  if (userType === null) {
    return null;
  }

  return {
    id: value.id,
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    isActive: value.isActive,
    userType,
  };
}

function isApiLoginSuccess(value: unknown): value is Omit<LoginSuccess, "user"> & { user: unknown } {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.accessToken === "string" && typeof value.expiresAt === "string" && "user" in value;
}

export async function loginWithPassword(email: string, password: string): Promise<AuthResult<LoginSuccess>> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const url = new URL(LOGIN_ROUTE, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante il login." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Login fallito (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un payload login non JSON." };
  }

  if (!isApiLoginSuccess(payload)) {
    return { ok: false, kind: "invalid-response", message: "Il payload login non rispetta il contratto previsto." };
  }

  const user = mapAuthenticatedUser(payload.user);
  if (!user) {
    return { ok: false, kind: "invalid-response", message: "Il payload utente autenticato non e valido." };
  }

  return { ok: true, data: { accessToken: payload.accessToken, expiresAt: payload.expiresAt, user } };
}

export async function getCurrentUser(token: string): Promise<AuthResult<AuthenticatedUserDto>> {
  const baseUrlResult = readApiBaseUrl();
  if (!baseUrlResult.ok) {
    return { ok: false, kind: "configuration", message: baseUrlResult.message };
  }

  const url = new URL(ME_ROUTE, baseUrlResult.value);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, kind: "network", message: "Backend non raggiungibile durante il bootstrap sessione." };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura utente corrente fallita (${response.status}).`;
    return { ok: false, kind: "http", statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, kind: "invalid-response", message: "Il backend ha restituito un payload /me non JSON." };
  }

  const user = mapAuthenticatedUser(payload);
  if (!user) {
    return { ok: false, kind: "invalid-response", message: "Il payload /me non rispetta il contratto previsto." };
  }

  return { ok: true, data: user };
}