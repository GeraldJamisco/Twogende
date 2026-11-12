import { request } from "./client";
import type { PublicUser } from "../types";

/**
 * Rating the other side once a ride is done.
 *
 * Ratings are double-blind: what the other person said stays sealed until you
 * have said yours. `their_rating.waiting` with a null `rating` is the locked
 * state, and it is the reason the screen is worth finishing.
 */

/** One chip under the stars. `slug` is what gets stored - never the label. */
export type RatingTag = {
  slug: string;
  label: string;
  category: string;
  emoji: string;
  positive: boolean;
};

export type Rating = {
  id: number;
  booking_id: number;
  stars: number;
  tags: string[];
  comment: string | null;
  ratee_role: "driver" | "passenger";
  left_at: string | null;
};

export type TheirRating = {
  /** They have rated you. Whether you may read it is `revealed`. */
  waiting: boolean;
  revealed: boolean;
  rating: Rating | null;
};

/** Tag vocabulary, keyed by star count. Every star count arrives at once so
 *  tapping a different star never waits on the network. */
export type TagsByStars = Record<string, RatingTag[]>;

export type PendingRating = {
  due: boolean;
  rating_role: "driver" | "passenger" | null;
  tags: TagsByStars;
  /** How many chips to show before the "More" chip. */
  chips_before_more: number;
  their_rating: TheirRating;
};

export type SubmittedRating = {
  data: Rating;
  their_rating: TheirRating;
};

export function pendingRating(token: string, bookingId: number) {
  return request<PendingRating>(`/bookings/${bookingId}/rating`, { token });
}

export function submitRating(
  token: string,
  bookingId: number,
  body: { stars: number; tags?: string[]; comment?: string },
) {
  return request<SubmittedRating>(`/bookings/${bookingId}/rating`, {
    method: "POST",
    token,
    body,
  });
}

/* ---------- the driver's end-of-trip summary ---------- */

export type TripEarnings = {
  /** What passengers contributed, in whole shillings. */
  gross: number;
  /** What Twogende keeps. */
  service_fee: number;
  /** What reaches the driver. Always gross − service_fee. */
  net: number;
  commission_rate: number;
};

export type SummaryPassenger = {
  booking_id: number;
  passenger: PublicUser;
  seats: number;
  pickup_name: string;
  contribution: number;
  service_fee: number;
  net: number;
  rating_due: boolean;
  their_rating: TheirRating;
};

export type TripSummary = {
  trip_id: number;
  route: { origin: string; destination: string };
  departed_at: string | null;
  completed_at: string | null;
  /** Null when the driver never pressed start - no duration is invented. */
  duration_minutes: number | null;
  seats_filled: number;
  currency: string;
  earnings: TripEarnings;
  rating_tags: TagsByStars;
  chips_before_more: number;
  passengers: SummaryPassenger[];
};

export function tripSummary(token: string, tripId: number) {
  return request<{ data: TripSummary }>(`/trips/${tripId}/summary`, { token });
}
