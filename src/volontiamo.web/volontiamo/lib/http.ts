import "server-only";

export type HttpAdapterErrorKind = "configuration" | "network" | "http" | "invalid-response";

export function readApiBaseUrl(): { ok: true; value: URL } | { ok: false; message: string } {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function readHttpErrorMessage(response: Response): Promise<string | null> {
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