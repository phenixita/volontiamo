import { EventResponse, PagedResponse } from './types';

const BASE_URL = 'http://10.0.2.2:5159/api/v1';

export async function fetchEvents(
  page: number = 1,
  pageSize: number = 15,
): Promise<PagedResponse<EventResponse>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const response = await fetch(`${BASE_URL}/events?${params}`);

  if (!response.ok) {
    throw new Error(`Errore nel caricamento eventi: ${response.status}`);
  }

  return response.json();
}
