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
  /** ISO datetime - "today, but not before 4pm". */
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
 * What other drivers ask on this route - the "Suggested USh 12k - 18k" line.
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

/**
 * The driver setting off. Stamps started_at, which is what the end-of-trip
 * summary measures the journey against - the published departure time is a
 * promise, not a clock.
 */
export function startTrip(token: string, tripId: number) {
  return request<{ data: Trip }>(`/trips/${tripId}/start`, { method: "POST", token });
}

/**
 * Finishing the journey. Accepted bookings complete with it, both sides'
 * trip counts move, and the commission on each seat is fixed - all in one
 * transaction, server-side.
 */
export function completeTrip(token: string, tripId: number) {
  return request<{ data: Trip }>(`/trips/${tripId}/complete`, { method: "POST", token });
}

/** One of the fixed reasons the cancel screen offers. `code` is what's stored. */
export type CancellationReason = { code: string; label: string };

export function cancellationReasons(token: string) {
  return request<{ data: CancellationReason[] }>("/trips/cancellation-reasons", { token });
}

/**
 * Calls the trip off.
 *
 * Server-side this also cancels every live booking and writes a notice into
 * each of those conversations - a reason is required because a cancellation
 * nobody can explain teaches us nothing about why rides fall through.
 *
 * `note` is the driver's own words. Passengers never see it.
 */
export function cancelTrip(
  token: string,
  tripId: number,
  reason: string,
  note?: string,
) {
  return request<{ data: Trip }>(`/trips/${tripId}/cancel`, {
    method: "POST",
    token,
    body: { reason, note },
  });
}

export function myTrips(token: string) {
  return request<Paginated<Trip>>("/trips/mine", { token });
}
