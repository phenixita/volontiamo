import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

import { readSessionToken } from './session';
import {
  ApiResult,
  AuthenticatedUser,
  EventResponse,
  EventStatus,
  LoginSuccess,
  NotificationKind,
  NotificationResponse,
  PagedResponse,
  ParticipantEventListView,
  ParticipantEventResponse,
  ParticipationStatus,
  UserType,
  VolunteerReportingResponse,
} from './types';

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

function mapParticipationStatus(value: unknown): ParticipationStatus | null {
  if (value === 0 || value === 'Candidata') return 'Candidata';
  if (value === 1 || value === 'Partecipa') return 'Partecipa';
  if (value === 2 || value === 'Rifiutata') return 'Rifiutata';
  if (value === 3 || value === 'NonInteressata') return 'NonInteressata';
  return null;
}

function mapNotificationKind(value: unknown): NotificationKind | null {
  if (value === 0 || value === 'EventCreated') return 'EventCreated';
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

function mapParticipantEvent(value: unknown): ParticipantEventResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const participationStatus = value.participationStatus === null
    ? null
    : mapParticipationStatus(value.participationStatus);

  if (
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.startAtUtc !== 'string' ||
    typeof value.endAtUtc !== 'string' ||
    (typeof value.location !== 'string' && value.location !== null) ||
    typeof value.operationalNotesMarkdown !== 'string' ||
    participationStatus === null && value.participationStatus !== null
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
    participationStatus,
  };
}

function mapEventDetailAsParticipant(value: unknown): ParticipantEventResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.startAtUtc !== 'string' ||
    typeof value.endAtUtc !== 'string' ||
    (typeof value.location !== 'string' && value.location !== null) ||
    typeof value.operationalNotesMarkdown !== 'string'
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
    participationStatus: null,
  };
}

function mapNotification(value: unknown): NotificationResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = mapNotificationKind(value.kind);
  if (
    typeof value.id !== 'string' ||
    kind === null ||
    typeof value.title !== 'string' ||
    typeof value.body !== 'string' ||
    typeof value.eventId !== 'number' ||
    typeof value.createdAt !== 'string' ||
    (typeof value.readAt !== 'string' && value.readAt !== null)
  ) {
    return null;
  }

  return {
    id: value.id,
    kind,
    title: value.title,
    body: value.body,
    eventId: value.eventId,
    createdAt: value.createdAt,
    readAt: value.readAt,
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

function mapParticipantEventsPage(value: unknown, page: number, pageSize: number): PagedResponse<ParticipantEventResponse> | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }

  const items = value.items.map(mapParticipantEvent);
  if (items.some(item => item === null) || typeof value.totalCount !== 'number') {
    return null;
  }

  return {
    items: items as ParticipantEventResponse[],
    page: typeof value.page === 'number' ? value.page : page,
    pageSize: typeof value.pageSize === 'number' ? value.pageSize : pageSize,
    totalCount: value.totalCount,
  };
}

function mapNotificationsPage(value: unknown, page: number, pageSize: number): PagedResponse<NotificationResponse> | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }

  const items = value.items.map(mapNotification);
  if (items.some(item => item === null) || typeof value.totalCount !== 'number') {
    return null;
  }

  return {
    items: items as NotificationResponse[],
    page: typeof value.page === 'number' ? value.page : page,
    pageSize: typeof value.pageSize === 'number' ? value.pageSize : pageSize,
    totalCount: value.totalCount,
  };
}

function mapUnreadCount(value: unknown): number | null {
  if (!isRecord(value) || typeof value.unreadCount !== 'number') {
    return null;
  }

  return value.unreadCount;
}

function mapVolunteerReporting(value: unknown): VolunteerReportingResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.totalHours !== 'number'
    || typeof value.participatedEventsCount !== 'number'
    || typeof value.rank !== 'number'
    || typeof value.totalVolunteers !== 'number'
  ) {
    return null;
  }

  return {
    totalHours: value.totalHours,
    participatedEventsCount: value.participatedEventsCount,
    rank: value.rank,
    totalVolunteers: value.totalVolunteers,
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

function emptyParticipantEventsResponse(
  page: number,
  pageSize: number,
): PagedResponse<ParticipantEventResponse> {
  return {
    items: [],
    page,
    pageSize,
    totalCount: 0,
  };
}

function emptyNotificationsResponse(
  page: number,
  pageSize: number,
): PagedResponse<NotificationResponse> {
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

export async function fetchMyEvents(
  view: ParticipantEventListView = 'available',
  page: number = 1,
  pageSize: number = 15,
): Promise<PagedResponse<ParticipantEventResponse>> {
  const params = new URLSearchParams({
    view,
    page: String(page),
    pageSize: String(pageSize),
  });

  try {
    const response = await fetchJson(`/events/my?${params}`);

    if (!response.ok) {
      console.warn(`Participant events API unavailable: ${response.status}`);
      return emptyParticipantEventsResponse(page, pageSize);
    }

    const payload: unknown = await response.json();
    const mapped = mapParticipantEventsPage(payload, page, pageSize);
    return mapped ?? emptyParticipantEventsResponse(page, pageSize);
  } catch (error) {
    console.warn('Participant events API request failed', error);
    return emptyParticipantEventsResponse(page, pageSize);
  }
}

export async function fetchNotificationsInbox(
  page: number = 1,
  pageSize: number = 15,
): Promise<PagedResponse<NotificationResponse>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  try {
    const response = await fetchJson(`/notifications?${params}`);

    if (!response.ok) {
      console.warn(`Notifications API unavailable: ${response.status}`);
      return emptyNotificationsResponse(page, pageSize);
    }

    const payload: unknown = await response.json();
    const mapped = mapNotificationsPage(payload, page, pageSize);
    return mapped ?? emptyNotificationsResponse(page, pageSize);
  } catch (error) {
    console.warn('Notifications API request failed', error);
    return emptyNotificationsResponse(page, pageSize);
  }
}

export async function fetchUnreadNotificationsCount(): Promise<ApiResult<number>> {
  let response: Response;
  try {
    response = await fetchJson('/notifications/unread-count');
  } catch {
    return { ok: false, message: 'Backend non raggiungibile durante il conteggio notifiche.' };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura conteggio notifiche fallita (${response.status}).`;
    return { ok: false, statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Il backend ha restituito un payload conteggio notifiche non JSON.' };
  }

  const unreadCount = mapUnreadCount(payload);
  if (unreadCount === null) {
    return { ok: false, message: 'Il payload conteggio notifiche non rispetta il contratto previsto.' };
  }

  return { ok: true, data: unreadCount };
}

async function mutateParticipation(
  path: string,
  method: 'PUT' | 'DELETE',
  networkMessage: string,
  baseMessage: string,
): Promise<ApiResult<ParticipantEventResponse>> {
  let response: Response;
  try {
    response = await fetchJson(
      path,
      method === 'PUT'
        ? {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
        : { method },
    );
  } catch {
    return { ok: false, message: networkMessage };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    return { ok: false, statusCode: response.status, message: detail ? `${baseMessage} (${response.status}). ${detail}` : `${baseMessage} (${response.status}).` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Il backend ha restituito un payload partecipazione non JSON.' };
  }

  const participantEvent = mapParticipantEvent(payload);
  if (!participantEvent) {
    return { ok: false, message: 'Il payload partecipazione non rispetta il contratto previsto.' };
  }

  return { ok: true, data: participantEvent };
}

export async function markNotificationAsRead(id: string): Promise<ApiResult<NotificationResponse>> {
  let response: Response;
  try {
    response = await fetchJson(`/notifications/${id}/read`, { method: 'PUT' });
  } catch {
    return { ok: false, message: 'Backend non raggiungibile durante la marcatura della notifica.' };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Marcatura notifica fallita (${response.status}).`;
    return { ok: false, statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Il backend ha restituito un payload notifica non JSON.' };
  }

  const notification = mapNotification(payload);
  if (!notification) {
    return { ok: false, message: 'Il payload notifica non rispetta il contratto previsto.' };
  }

  return { ok: true, data: notification };
}

export async function markAllNotificationsAsRead(): Promise<ApiResult<number>> {
  let response: Response;
  try {
    response = await fetchJson('/notifications/read-all', { method: 'PUT' });
  } catch {
    return { ok: false, message: 'Backend non raggiungibile durante la marcatura di tutte le notifiche.' };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Marcatura massiva notifiche fallita (${response.status}).`;
    return { ok: false, statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Il backend ha restituito un payload marcatura notifiche non JSON.' };
  }

  const unreadCount = mapUnreadCount(payload);
  if (unreadCount === null) {
    return { ok: false, message: 'Il payload marcatura notifiche non rispetta il contratto previsto.' };
  }

  return { ok: true, data: unreadCount };
}

export async function applyForEvent(eventId: number): Promise<ApiResult<ParticipantEventResponse>> {
  return mutateParticipation(
    `/events/${eventId}/participation/candidata`,
    'PUT',
    'Backend non raggiungibile durante la candidatura all\'evento.',
    'Candidatura all\'evento fallita',
  );
}

export async function markEventNotInterested(eventId: number): Promise<ApiResult<ParticipantEventResponse>> {
  return mutateParticipation(
    `/events/${eventId}/participation/non-interessata`,
    'PUT',
    'Backend non raggiungibile durante il salvataggio della non disponibilita.',
    'Aggiornamento non interessata fallito',
  );
}

export async function restoreEventAvailability(eventId: number): Promise<ApiResult<ParticipantEventResponse>> {
  return mutateParticipation(
    `/events/${eventId}/participation/non-interessata`,
    'DELETE',
    'Backend non raggiungibile durante il ripristino disponibilita.',
    'Ripristino disponibilita fallito',
  );
}

export async function fetchMyReport(): Promise<ApiResult<VolunteerReportingResponse>> {
  let response: Response;
  try {
    response = await fetchJson('/reports/me');
  } catch {
    return { ok: false, message: 'Backend non raggiungibile durante il caricamento delle statistiche.' };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura statistiche fallita (${response.status}).`;
    return { ok: false, statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Il backend ha restituito un payload statistiche non JSON.' };
  }

  const report = mapVolunteerReporting(payload);
  if (!report) {
    return { ok: false, message: 'Il payload statistiche non rispetta il contratto previsto.' };
  }

  return { ok: true, data: report };
}

export async function fetchEventDetailById(eventId: number): Promise<ApiResult<ParticipantEventResponse>> {
  let response: Response;
  try {
    response = await fetchJson(`/events/${eventId}`);
  } catch {
    return { ok: false, message: 'Backend non raggiungibile durante il caricamento del dettaglio evento.' };
  }

  if (!response.ok) {
    const detail = await readHttpErrorMessage(response);
    const baseMessage = `Lettura dettaglio evento fallita (${response.status}).`;
    return { ok: false, statusCode: response.status, message: detail ? `${baseMessage} ${detail}` : baseMessage };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Il backend ha restituito un payload dettaglio evento non JSON.' };
  }

  const event = mapEventDetailAsParticipant(payload);
  if (!event) {
    return { ok: false, message: 'Il payload dettaglio evento non rispetta il contratto previsto.' };
  }

  return { ok: true, data: event };
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
