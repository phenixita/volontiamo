import { EventResponse, PagedResponse } from './types';

// Device fisico: usa l'IP locale del PC sulla stessa rete WiFi
// Emulatore Android: usa 'http://10.0.2.2:5159/api/v1'
const BASE_URL = 'http://192.168.1.72:5159/api/v1';

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
