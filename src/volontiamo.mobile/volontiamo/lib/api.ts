import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

import { EventResponse, PagedResponse } from './types';

const API_PORT = 5159;
const API_PREFIX = '/api/v1';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith(API_PREFIX) ? baseUrl : `${baseUrl}${API_PREFIX}`;
}

function resolveConfiguredBaseUrl(): string | null {
  const configuredBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;

  if (typeof configuredBaseUrl === 'string' && configuredBaseUrl.length > 0) {
    return normalizeBaseUrl(configuredBaseUrl);
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

export async function fetchEvents(
  page: number = 1,
  pageSize: number = 15,
): Promise<PagedResponse<EventResponse>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  try {
    const response = await fetch(`${BASE_URL}/events?${params}`);

    if (!response.ok) {
      console.warn(`Events API unavailable: ${response.status}`);
      return emptyEventsResponse(page, pageSize);
    }

    return response.json();
  } catch (error) {
    console.warn('Events API request failed', error);
    return emptyEventsResponse(page, pageSize);
  }
}
