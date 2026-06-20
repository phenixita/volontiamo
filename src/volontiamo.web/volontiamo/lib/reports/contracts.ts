import type { HttpAdapterErrorKind } from "@/lib/http";

export interface PagedResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ReportingSummaryDto {
  totalHours: number;
  concludedEventsCount: number;
  volunteersCount: number;
}

export interface ReportingLeaderboardEntryDto {
  userId: string;
  firstName: string;
  lastName: string;
  totalHours: number;
  participatedEventsCount: number;
}

export interface ReadReportingSummaryInput {
  fromUtc?: string;
  toUtc?: string;
}

export interface ReadReportingLeaderboardInput extends ReadReportingSummaryInput {
  page: number;
  pageSize: number;
}

export type ReportingReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: HttpAdapterErrorKind; message: string; statusCode?: number };