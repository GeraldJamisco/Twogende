import { request } from './client';

export type PlaceSuggestion = {
  place_id: string;
  primary_text: string;
  secondary_text: string;
};

export type Place = {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

/**
 * Google bills autocomplete per session: the keystrokes of one search share a
 * token, and the details lookup that follows closes it. Generate one when a
 * field gains focus and drop it once a place is chosen.
 */
export function newSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function autocomplete(token: string, query: string, sessionToken: string) {
  return request<{ data: PlaceSuggestion[] }>('/places/autocomplete', {
    token,
    query: { query, session_token: sessionToken },
  });
}

/**
 * Turn a GPS fix into a named place - what "Use my current location" resolves
 * to. A bare coordinate can't be matched against a trip by identifier, so the
 * handset's position has to become a real place first.
 */
export function nearestPlace(token: string, latitude: number, longitude: number) {
  return request<{ data: Place }>("/places/nearest", {
    token,
    query: { latitude, longitude },
  });
}

export function placeDetails(token: string, placeId: string, sessionToken: string) {
  return request<{ data: Place }>(`/places/${placeId}`, {
    token,
    query: { session_token: sessionToken },
  });
}
