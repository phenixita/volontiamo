export type EventStatus = 'Draft' | 'Active' | 'Concluded';

export type ParticipationStatus = 'Candidata' | 'Partecipa' | 'Rifiutata' | 'NonInteressata';

export type ParticipantEventListView = 'available' | 'non-interessata';

export type UserType = 0 | 1;

export type AuthenticatedUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  userType: UserType;
};

export type LoginSuccess = {
  accessToken: string;
  expiresAt: string;
  user: AuthenticatedUser;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; statusCode?: number };

export type EventResponse = {
  id: number;
  name: string;
  startAtUtc: string;
  endAtUtc: string;
  location: string | null;
  operationalNotesMarkdown: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
};

export type ParticipantEventResponse = {
  id: number;
  name: string;
  startAtUtc: string;
  endAtUtc: string;
  location: string | null;
  operationalNotesMarkdown: string;
  participationStatus: ParticipationStatus | null;
};

export type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type VolunteerReportingResponse = {
  totalHours: number;
  participatedEventsCount: number;
  rank: number;
  totalVolunteers: number;
};

export function formatUserType(userType: UserType): string {
  return userType === 0 ? 'Lilt' : 'Volontario';
}
