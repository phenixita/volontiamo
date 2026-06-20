"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { EventStatus } from "@/lib/events/contracts";
import { acceptCandidate, createEvent, deleteEvent, rejectCandidate, updateEvent } from "@/lib/events/http-events-adapter";

const ROME_TIME_ZONE = "Europe/Rome";

function readRequiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseStatus(raw: string): EventStatus {
  if (raw === "1") return 1;
  if (raw === "2") return 2;
  return 0;
}

function readRomeParts(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function romeLocalToUtcIso(date: string, time: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !timeMatch) {
    return null;
  }

  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
  const naiveUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute);
  const initialParts = readRomeParts(new Date(naiveUtc));
  const initialAsUtc = Date.UTC(initialParts.year, initialParts.month - 1, initialParts.day, initialParts.hour, initialParts.minute);
  const offsetMinutes = (initialAsUtc - naiveUtc) / 60_000;
  const utc = new Date(naiveUtc - offsetMinutes * 60_000);

  return utc.toISOString();
}

function redirectToNewWithError(message: string): never {
  redirect(`/events/new?error=${encodeURIComponent(message)}`);
}

export async function createEventAction(formData: FormData) {
  const name = readRequiredString(formData, "name");
  const startDate = readRequiredString(formData, "startDate");
  const startTime = readRequiredString(formData, "startTime");
  const endDate = readRequiredString(formData, "endDate");
  const endTime = readRequiredString(formData, "endTime");
  const location = readRequiredString(formData, "location");
  const operationalNotesMarkdown = readRequiredString(formData, "operationalNotesMarkdown");
  const status = parseStatus(readRequiredString(formData, "status"));

  const startAtUtc = romeLocalToUtcIso(startDate, startTime);
  const endAtUtc = romeLocalToUtcIso(endDate, endTime);
  if (!startAtUtc || !endAtUtc) {
    redirectToNewWithError("Date e orari non sono validi.");
  }

  const result = await createEvent({
    name,
    startAtUtc,
    endAtUtc,
    location: location.length > 0 ? location : null,
    operationalNotesMarkdown,
    status,
  });

  if (!result.ok) {
    redirectToNewWithError(result.message);
  }

  revalidatePath("/events");
  redirect("/events");
}

export async function deleteEventAction(id: number) {
  const result = await deleteEvent(id);
  if (!result.ok) {
    redirect(`/events?error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/events");
  redirect("/events");
}

export async function updateEventAction(id: number, formData: FormData) {
  const name = readRequiredString(formData, "name");
  const startDate = readRequiredString(formData, "startDate");
  const startTime = readRequiredString(formData, "startTime");
  const endDate = readRequiredString(formData, "endDate");
  const endTime = readRequiredString(formData, "endTime");
  const location = readRequiredString(formData, "location");
  const operationalNotesMarkdown = readRequiredString(formData, "operationalNotesMarkdown");
  const status = parseStatus(readRequiredString(formData, "status"));

  const startAtUtc = romeLocalToUtcIso(startDate, startTime);
  const endAtUtc = romeLocalToUtcIso(endDate, endTime);
  if (!startAtUtc || !endAtUtc) {
    redirect(`/events/${id}/edit?error=${encodeURIComponent("Date e orari non sono validi.")}`);
  }

  const result = await updateEvent(id, {
    name,
    startAtUtc,
    endAtUtc,
    location: location.length > 0 ? location : null,
    operationalNotesMarkdown,
    status,
  });

  if (!result.ok) {
    redirect(`/events/${id}/edit?error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  redirect(`/events/${id}`);
}

export async function acceptCandidateAction(eventId: number, userId: string) {
  const result = await acceptCandidate(eventId, userId);
  if (!result.ok) {
    redirect(`/events/${eventId}?error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function rejectCandidateAction(eventId: number, userId: string) {
  const result = await rejectCandidate(eventId, userId);
  if (!result.ok) {
    redirect(`/events/${eventId}?error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}