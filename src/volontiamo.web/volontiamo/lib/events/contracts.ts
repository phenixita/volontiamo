export interface PagedResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export type EventStatus = 0 | 1 | 2;

export interface EventDto {
  id: number;
  name: string;
  startAtUtc: string;
  endAtUtc: string;
  location: string | null;
  operationalNotesMarkdown: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  acceptedParticipantsCount: number;
}

export interface EventVolunteerDto {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

export interface EventDetailDto {
  id: number;
  name: string;
  startAtUtc: string;
  endAtUtc: string;
  location: string | null;
  operationalNotesMarkdown: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  acceptedParticipantsCount: number;
  acceptedParticipants: EventVolunteerDto[];
}

export interface ReadEventsInput {
  name?: string;
  status?: "default" | "draft" | "active" | "concluded" | "all";
  page: number;
  pageSize: number;
}

export interface CreateEventInput {
  name: string;
  startAtUtc: string;
  endAtUtc: string;
  location: string | null;
  operationalNotesMarkdown: string;
  status: EventStatus;
}

export type UpdateEventInput = CreateEventInput;

export type EventMutationResult =
  | { ok: true; data?: EventDto }
  | { ok: false; kind: EventsReadErrorKind; message: string; statusCode?: number };

export type EventsReadErrorKind =
  | "configuration"
  | "network"
  | "http"
  | "invalid-response";

export type EventsReadResult =
  | {
      ok: true;
      data: PagedResponse<EventDto>;
    }
  | {
      ok: false;
      kind: EventsReadErrorKind;
      message: string;
      statusCode?: number;
    };

export type EventDetailReadResult =
  | { ok: true; data: EventDetailDto }
  | {
      ok: false;
      kind: EventsReadErrorKind;
      message: string;
      statusCode?: number;
    };