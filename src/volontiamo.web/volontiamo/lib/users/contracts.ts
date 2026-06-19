import type { UserType } from "@/lib/auth/contracts";
import type { HttpAdapterErrorKind } from "@/lib/http";

export interface PagedResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  enrollmentDate: string;
  endDate: string | null;
  isActive: boolean;
  userType: UserType;
  occupation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  initialPassword: string;
  phone: string | null;
  dateOfBirth: string | null;
  enrollmentDate: string;
  endDate: string | null;
  isActive: boolean;
  userType: UserType;
  occupation: string | null;
}

export interface UpdateUserInput extends Omit<CreateUserInput, "initialPassword"> {
  newPassword: string | null;
}

export type UsersReadResult =
  | {
      ok: true;
      data: PagedResponse<UserDto>;
    }
  | {
      ok: false;
      kind: HttpAdapterErrorKind;
      message: string;
      statusCode?: number;
    };

export type UserReadResult =
  | { ok: true; data: UserDto }
  | {
      ok: false;
      kind: HttpAdapterErrorKind;
      message: string;
      statusCode?: number;
    };

export type UserMutationResult =
  | { ok: true; data: UserDto }
  | {
      ok: false;
      kind: HttpAdapterErrorKind;
      message: string;
      statusCode?: number;
    };
