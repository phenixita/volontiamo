import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

import { readSessionToken } from './session';
import { ApiResult, AuthenticatedUser, EventResponse, EventStatus, LoginSuccess, PagedResponse, UserType } from './types';

const API_PORT = 5159;
const API_PREFIX = '/api/v1';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith(API_PREFIX) ? baseUrl : `${baseUrl}${API_PREFIX}`;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeConfiguredHost(baseUrl: string): string {
  if (Platform.OS !== 'android') {
    return stripTrailingSlash(baseUrl);
  }

  try {
    const url = new URL(baseUrl);

    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
      url.hostname = '10.0.2.2';
    }

    return stripTrailingSlash(url.toString());
  } catch {
    return stripTrailingSlash(baseUrl);
  }
}

function resolveConfiguredBaseUrl(): string | null {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (typeof envBaseUrl === 'string' && envBaseUrl.length > 0) {
    return normalizeBaseUrl(normalizeConfiguredHost(envBaseUrl));
  }

  const configuredBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;

  if (typeof configuredBaseUrl === 'string' && configuredBaseUrl.length > 0) {
    return normalizeBaseUrl(normalizeConfiguredHost(configuredBaseUrl));
  }

  return null;
}

function normalizeHost(host: string): string {
  if (Platform.OS === 'android' && ['localhost', '127.0.0.1', '0.0.0.0'].includes(host)) {
    return '10.0.2.2';
  }

  return host;
}

function resolveBundleHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  const bundleUrl: string | undefined = NativeModules.SourceCode?.scriptURL;
  const source = hostUri ?? bundleUrl;
  const host = source?.match(/^[a-z]+:\/\/([^/:]+)|^([^/:]+)(?::\d+)?$/i);
  const resolvedHost = host?.[1] ?? host?.[2];

  return resolvedHost ? normalizeHost(resolvedHost) : null;
}

function resolveBaseUrl(): string {
  const configuredBaseUrl = resolveConfiguredBaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const host = resolveBundleHost();

  if (host) {
    return `http://${host}:${API_PORT}${API_PREFIX}`;
  }

  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${fallbackHost}:${API_PORT}${API_PREFIX}`;
}

const BASE_URL = resolveBaseUrl();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readHttpErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload)) {
      if (typeof payload.detail === 'string') return payload.detail;
      if (typeof payload.title === 'string') return payload.title;
    }
  } catch {
  }

  return null;
}

function mapUserType(value: unknown): UserType | null {
  if (value === 0 || value === 'Lilt') return 0;
  if (value === 1 || value === 'Volontario') return 1;
  return null;
}

function mapEventStatus(value: unknown): EventStatus | null {
  if (value === 0 || value === 'Draft') return 'Draft';
  if (value === 1 || value === 'Active') return 'Active';
  if (value === 2 || value === 'Concluded') return 'Concluded';
  return null;
}

function mapAuthenticatedUser(value: unknown): AuthenticatedUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const userType = mapUserType(value.userType);
  if (
    typeof value.id !== 'string' ||
    typeof value.firstName !== 'string' ||
    typeof value.lastName !== 'string' ||
    typeof value.email !== 'string' ||
    typeof value.isActive !== 'boolean' ||
    userType === null
  ) {
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

function mapEvent(value: unknown): EventResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = mapEventStatus(value.status);
  if (
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.startAtUtc !== 'string' ||
    typeof value.endAtUtc !== 'string' ||
    (typeof value.location !== 'string' && value.location !== null) ||
    typeof value.operationalNotesMarkdown !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    status === null
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    startAtUtc: value.startAtUtc,
    endAtUtc: value.endAtUtc,
    location: value.location,
    operationalNotesMarkdown: value.operationalNotesMarkdown,
    status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function mapEventsPage(value: unknown, page: number, pageSize: number): PagedResponse<EventResponse> | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }

  const items = value.items.map(mapEvent);
  if (items.some(item => item === null) || typeof value.totalCount !== 'number') {
    return null;
  }

  return {
    items: items as EventResponse[],
    page: typeof value.page === 'number' ? value.page : page,
    pageSize: typeof value.pageSize === 'number' ? value.pageSize : pageSize,
    totalCount: value.totalCount,
  };
}

async function fetchJson(path: string, init: RequestInit = {}, token?: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  const sessionToken = token ?? await readSessionToken();
  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return fetch(`${BASE_URL}${path}`, { ...init, headers });
}

function emptyEventsResponse(
  page: number,
  pageSize: number,
): PagedResponse<EventResponse> {
  return {
    items: [],
    page,
    pageSize,
    totalCount: 0,
  };
}

export async function fetchEvents(
  page: number = 1,
  pageSize: number = 15,
): Promise<PagedResponse<EventResponse>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  try {
    const response = await fetchJson(`/events?${params}`);

    if (!response.ok) {
      console.warn(`Events API unavailable: ${response.status}`);
      return emptyEventsResponse(page, pageSize);
    }

    const payload: unknown = await response.json();
    const mapped = mapEventsPage(payload, page, pageSize);
    return mapped ?? emptyEventsResponse(page, pageSize);
  } catch (error) {
    console.warn('Events API request failed', error);
    return emptyEventsResponse(page, pageSize);
  }
}

export async function loginWithPassword(email: string, password: string): Promise<ApiResult<LoginSuccess>> {
  let response: Response;
  try {
    response = await fetchJson('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, null);
  } catch {
    return { ok: false, message: 'Backend non raggiungibile durante il login.' };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Login fallito (${response.status}).`;
    return { ok: false, statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Il backend ha restituito un payload login non JSON.' };
  }

  if (!isRecord(payload) || typeof payload.accessToken !== 'string' || typeof payload.expiresAt !== 'string') {
    return { ok: false, message: 'Il payload login non rispetta il contratto previsto.' };
  }

  const user = mapAuthenticatedUser(payload.user);
  if (!user) {
    return { ok: false, message: 'Il payload utente autenticato non e valido.' };
  }

  return { ok: true, data: { accessToken: payload.accessToken, expiresAt: payload.expiresAt, user } };
}

export async function getCurrentUser(token?: string): Promise<ApiResult<AuthenticatedUser>> {
  let response: Response;
  try {
    response = await fetchJson('/auth/me', { method: 'GET' }, token);
  } catch {
    return { ok: false, message: 'Backend non raggiungibile durante il bootstrap sessione.' };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura utente corrente fallita (${response.status}).`;
    return { ok: false, statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Il backend ha restituito un payload /me non JSON.' };
  }

  const user = mapAuthenticatedUser(payload);
  if (!user) {
    return { ok: false, message: 'Il payload /me non rispetta il contratto previsto.' };
  }

  return { ok: true, data: user };
}
