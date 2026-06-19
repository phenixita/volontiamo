import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { LoginSuccess } from "@/lib/auth/contracts";
import { getCurrentUser } from "@/lib/auth/http-auth-adapter";

const SESSION_COOKIE_NAME = "volontiamo_session";

export async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  return cookie?.value?.trim() || null;
}

export async function setSession(login: LoginSuccess): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: login.accessToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(login.expiresAt),
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireCurrentUser() {
  const token = await readSessionToken();
  if (!token) {
    redirect("/login");
  }

  const currentUserResult = await getCurrentUser(token);
  if (!currentUserResult.ok) {
    if (currentUserResult.statusCode === 401 || currentUserResult.statusCode === 404) {
      redirect("/login");
    }

    return currentUserResult;
  }

  return currentUserResult;
}