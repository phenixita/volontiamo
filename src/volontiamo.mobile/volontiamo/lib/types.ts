export type EventStatus = 'Draft' | 'Active' | 'Concluded';

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

export type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};
