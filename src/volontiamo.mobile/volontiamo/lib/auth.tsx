import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getCurrentUser, loginWithPassword } from './api';
import { clearSessionToken, readSessionToken, saveSessionToken } from './session';
import { AuthenticatedUser } from './types';

const VOLUNTEER_ONLY_MESSAGE = 'Questa app e riservata ai volontari. Accedi con un account volontario.';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isVolunteer(user: AuthenticatedUser): boolean {
  return user.userType === 1;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await clearSessionToken();
    setUser(null);
    setError(null);
    setStatus('unauthenticated');
  }, []);

  const rejectNonVolunteerSession = useCallback(async () => {
    await clearSessionToken();
    setUser(null);
    setError(VOLUNTEER_ONLY_MESSAGE);
    setStatus('unauthenticated');
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const token = await readSessionToken();

    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    const result = await getCurrentUser(token);
    if (!result.ok) {
      await clearSessionToken();
      setUser(null);
      setError(result.message);
      setStatus('unauthenticated');
      return;
    }

    if (!isVolunteer(result.data)) {
      await rejectNonVolunteerSession();
      return;
    }

    setUser(result.data);
    setError(null);
    setStatus('authenticated');
  }, [rejectNonVolunteerSession]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const token = await readSessionToken();
      if (!active) return;

      if (!token) {
        setStatus('unauthenticated');
        return;
      }

      const result = await getCurrentUser(token);
      if (!active) return;

      if (!result.ok) {
        await clearSessionToken();
        setUser(null);
        setError(result.message);
        setStatus('unauthenticated');
        return;
      }

      if (!isVolunteer(result.data)) {
        await rejectNonVolunteerSession();
        return;
      }

      setUser(result.data);
      setError(null);
      setStatus('authenticated');
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [rejectNonVolunteerSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginWithPassword(email, password);

    if (!result.ok) {
      setError(result.message);
      return { ok: false as const, message: result.message };
    }

    if (!isVolunteer(result.data.user)) {
      await rejectNonVolunteerSession();
      return { ok: false as const, message: VOLUNTEER_ONLY_MESSAGE };
    }

    await saveSessionToken(result.data.accessToken);
    setUser(result.data.user);
    setError(null);
    setStatus('authenticated');
    return { ok: true as const };
  }, [rejectNonVolunteerSession]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    error,
    signIn,
    signOut,
    refreshCurrentUser,
  }), [error, refreshCurrentUser, signIn, signOut, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}