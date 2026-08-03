/**
 * Wire shapes from the Laravel API in ../api. Keep these in step with the
 * resource classes: UserResource, PublicUserResource, TripResource.
 */

export type Reputation = {
  rating_as_driver: number | null;
  ratings_as_driver_count: number;
  rating_as_passenger: number | null;
  ratings_as_passenger_count: number;
  trips_as_driver: number;
  trips_as_passenger: number;
};

/** Someone else's profile. Never carries a phone number see PublicUserResource. */
export type PublicUser = {
  id: number;
  name: string;
  /** One word, resolved server-side. Used wherever a person is identified. */
  first_name: string | null;
  bio: string | null;
  photo_url: string | null;
  verification: { phone: boolean; identity: boolean };
  reputation: Reputation;
  joined_at: string | null;
};

/** The signed-in user this one does include their own phone. */
export type Me = PublicUser & {
  phone: string;
  phone_display: string;
  email: string | null;
  /** False until a newly created account has been given a name. */
  profile_complete: boolean;
  verification: { phone: boolean; identity: boolean; can_drive: boolean };
};

export type Vehicle = {
  id: number;
  make: string;
  model: string;
  colour: string;
  year: number | null;
  description: string;
  passenger_seats: number;
  photo_url: string | null;
  verified: boolean;
  status: "pending" | "approved" | "rejected";
  /** Four characters, so a passenger can pick the car out of a queue. */
  plate_last4: string | null;
  /**
   * "Toyota Premio · 402K" — the settled way a vehicle is identified: brand
   * and the last four of the plate, never the whole plate.
   */
  identifier: string;
};

export type BookingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled_by_passenger"
  | "cancelled_by_driver"
  | "completed";

export type BookingSummary = {
  id: number;
  status: BookingStatus;
  seats: number;
  contact_unlocked: boolean;
};

export type TripWaypoint = {
  name: string;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Trip = {
  id: number;
  driver?: PublicUser;
  vehicle?: Vehicle;
  origin: TripWaypoint;
  destination: TripWaypoint;
  /** ISO 8601. */
  departure_at: string;
  seats: { total: number; available: number };
  /** Whole shillings. "Contribution", never "fare". */
  contribution: { per_seat: number; currency: string };
  notes: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  my_booking?: BookingSummary | null;
  created_at: string | null;
};

export type Paginated<T> = {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};
