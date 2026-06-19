"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { UserType } from "@/lib/auth/contracts";
import { createUser, updateUser } from "@/lib/users/http-users-adapter";

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(formData: FormData, name: string): string | null {
  const value = readString(formData, name);
  return value.length > 0 ? value : null;
}

function readRequiredDate(formData: FormData, name: string): string {
  return readString(formData, name);
}

function readNullableDate(formData: FormData, name: string): string | null {
  return readNullableString(formData, name);
}

function readUserType(formData: FormData): UserType {
  return readString(formData, "userType") === "0" ? 0 : 1;
}

function redirectToNewWithError(message: string): never {
  redirect(`/users/new?error=${encodeURIComponent(message)}`);
}

function redirectToEditWithError(id: string, message: string): never {
  redirect(`/users/${id}?error=${encodeURIComponent(message)}`);
}

export async function createUserAction(formData: FormData) {
  const result = await createUser({
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    email: readString(formData, "email"),
    initialPassword: readString(formData, "initialPassword"),
    phone: readNullableString(formData, "phone"),
    dateOfBirth: readNullableDate(formData, "dateOfBirth"),
    enrollmentDate: readRequiredDate(formData, "enrollmentDate"),
    endDate: readNullableDate(formData, "endDate"),
    isActive: formData.has("isActive"),
    userType: readUserType(formData),
    occupation: readNullableString(formData, "occupation"),
  });

  if (!result.ok) {
    redirectToNewWithError(result.message);
  }

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUserAction(id: string, formData: FormData) {
  const newPassword = readNullableString(formData, "newPassword");
  const result = await updateUser(id, {
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    email: readString(formData, "email"),
    newPassword,
    phone: readNullableString(formData, "phone"),
    dateOfBirth: readNullableDate(formData, "dateOfBirth"),
    enrollmentDate: readRequiredDate(formData, "enrollmentDate"),
    endDate: readNullableDate(formData, "endDate"),
    isActive: formData.has("isActive"),
    userType: readUserType(formData),
    occupation: readNullableString(formData, "occupation"),
  });

  if (!result.ok) {
    redirectToEditWithError(id, result.message);
  }

  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  redirect("/users");
}