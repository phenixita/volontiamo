"use server";

import { redirect } from "next/navigation";

import { loginWithPassword } from "@/lib/auth/http-auth-adapter";
import { clearSession, setSession } from "@/lib/auth/session";

function readRequiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToLoginWithError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  const email = readRequiredString(formData, "email");
  const password = readRequiredString(formData, "password");

  if (!email || !password) {
    redirectToLoginWithError("Email e password sono obbligatorie.");
  }

  const result = await loginWithPassword(email, password);
  if (!result.ok) {
    redirectToLoginWithError(result.message);
  }

  await setSession(result.data);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}