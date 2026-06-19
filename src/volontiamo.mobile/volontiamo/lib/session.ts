import * as SecureStore from 'expo-secure-store';

const SESSION_TOKEN_KEY = 'volontiamo_session_token';

let memoryToken: string | null = null;

export async function readSessionToken(): Promise<string | null> {
  if (memoryToken) {
    return memoryToken;
  }

  const storedToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  memoryToken = storedToken?.trim() || null;
  return memoryToken;
}

export async function saveSessionToken(token: string): Promise<void> {
  memoryToken = token;
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  memoryToken = null;
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}