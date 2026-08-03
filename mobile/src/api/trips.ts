import { request } from "./client";
import type { Paginated, Trip } from "../types";

export type TripSearchParams = {
  origin_place_id?: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_place_id?: string;
  destination_latitude?: number;
  destination_longitude?: number;
  date?: string;
  /** ISO datetime — "today, but not before 4pm". */
  after?: string;
  seats?: number;
  /** Backs the filter chips. Defaults to departure order. */
  sort?: "departure" | "price";
};

/**
 * Search and the home feed are the same endpoint the feed simply omits the
 * place filters.
 */
export function searchTrips(token: string, params: TripSearchParams = {}) {
  return request<Paginated<Trip>>("/trips", { token, query: params });
}

export function showTrip(token: string, id: number) {
  return request<{ data: Trip }>(`/trips/${id}`, { token });
}

export type PriceSuggestion = {
  data: { low: number; high: number; currency: string } | null;
  sample_size: number;
};

/**
 * What other drivers ask on this route — the "Suggested USh 12k–18k" line.
 * `data` is null when too few trips exist to say anything useful.
 */
export function priceSuggestion(
  token: string,
  params: { origin_place_id?: string; destination_place_id?: string },
) {
  return request<PriceSuggestion>("/trips/price-suggestion", { token, query: params });
}

export type CreateTripInput = {
  vehicle_id: number;
  origin: { place_id: string; name: string; latitude: number; longitude: number };
  destination: { place_id: string; name: string; latitude: number; longitude: number };
  /** ISO 8601. */
  departure_at: string;
  seats_total: number;
  /** Whole shillings. */
  contribution_per_seat: number;
  notes?: string | null;
};

export function createTrip(token: string, input: CreateTripInput) {
  return request<{ data: Trip }>("/trips", { method: "POST", token, body: input });
}

/** Calls the trip off. Live bookings are cancelled with it, server-side. */
export function cancelTrip(token: string, tripId: number, reason?: string) {
  return request<{ data: Trip }>(`/trips/${tripId}/cancel`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export function myTrips(token: string) {
  return request<Paginated<Trip>>("/trips/mine", { token });
}
