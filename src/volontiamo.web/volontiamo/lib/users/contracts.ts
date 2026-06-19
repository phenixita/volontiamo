export interface PagedResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface VolunteerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
}

export type VolunteersReadErrorKind =
  | "configuration"
  | "network"
  | "http"
  | "invalid-response";

export type VolunteersReadResult =
  | {
      ok: true;
      data: PagedResponse<VolunteerDto>;
    }
  | {
      ok: false;
      kind: VolunteersReadErrorKind;
      message: string;
      statusCode?: number;
    };
