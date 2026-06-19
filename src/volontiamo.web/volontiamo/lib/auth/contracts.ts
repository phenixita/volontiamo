import type { HttpAdapterErrorKind } from "@/lib/http";

export type UserType = 0 | 1;

export interface AuthenticatedUserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  userType: UserType;
}

export interface LoginSuccess {
  accessToken: string;
  expiresAt: string;
  user: AuthenticatedUserDto;
}

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: HttpAdapterErrorKind; message: string; statusCode?: number };

export function formatUserType(userType: UserType): string {
  return userType === 0 ? "Lilt" : "Volontario";
}