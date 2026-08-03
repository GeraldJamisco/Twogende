import { request } from "./client";
import type { PublicUser, Trip } from "../types";

export type BookingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled_by_passenger"
  | "cancelled_by_driver"
  | "completed";

export type Booking = {
  id: number;
  trip_id: number;
  passenger?: PublicUser;
  seats: number;
  /** Null name means they're joining at the trip's own origin. */
  pickup: {
    name: string | null;
    place_id: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  contribution: { per_seat: number; total: number; currency: string };
  /** Loaded by showBooking(); absent from list endpoints. */
  trip?: Trip;
  /**
   * The other party, from the reader's point of view — resolved server-side so
   * the chat screen serves driver and passenger without re-deriving it.
   */
  with?: PublicUser | null;
  /** When this conversation stops accepting messages. Enforced server-side. */
  chat: { closes_at: string | null; open: boolean };
  status: BookingStatus;
  message: string | null;
  contact_unlocked: boolean;
  rejection_reason: string | null;
  requested_at: string | null;
  responded_at: string | null;
};

/**
 * One booking with everything the chat header needs — driver, vehicle, route,
 * and when the conversation closes.
 */
export function showBooking(token: string, bookingId: number) {
  return request<{ data: Booking }>(`/bookings/${bookingId}`, { token });
}

/** Requests on one of the driver's own trips, pending first. */
export function bookingsForTrip(token: string, tripId: number) {
  return request<{ data: Booking[] }>(`/trips/${tripId}/bookings`, { token });
}

/** The signed-in passenger's own bookings. */
export function myBookings(token: string) {
  return request<{ data: Booking[] }>("/bookings", { token });
}

export function requestSeat(
  token: string,
  tripId: number,
  input: {
    seats?: number;
    pickup?: { place_id: string; name: string; latitude: number; longitude: number };
    message?: string;
  } = {},
) {
  return request<{ data: Booking }>(`/trips/${tripId}/bookings`, {
    method: "POST",
    token,
    body: input,
  });
}

export function acceptBooking(token: string, bookingId: number) {
  return request<{ message: string; data: Booking }>(`/bookings/${bookingId}/accept`, {
    method: "POST",
    token,
  });
}

export function rejectBooking(token: string, bookingId: number, reason?: string) {
  return request<{ message: string; data: Booking }>(`/bookings/${bookingId}/reject`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export function cancelBooking(token: string, bookingId: number) {
  return request<{ message: string; data: Booking }>(`/bookings/${bookingId}/cancel`, {
    method: "POST",
    token,
  });
}
