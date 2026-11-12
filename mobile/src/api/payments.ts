import { request } from "./client";
import type { PublicUser } from "../types";

/**
 * Settling a booking's contribution.
 *
 * Twogende holds none of this money. Cash goes hand to hand and this only
 * records that it did; mobile money goes straight to the driver's own wallet
 * through an aggregator. A payment is only ever "completed" because somebody
 * credible said so - the passenger for cash, the provider for everything else.
 */

export type PaymentMethodId = "cash" | "mtn" | "airtel";

export type PaymentStatus =
  | "pending"
  | "awaiting_approval"
  | "completed"
  | "failed";

export type PaymentMethodOption = {
  method: PaymentMethodId;
  label: string;
  note: string;
  /** The provider's own name, as it appears on the phone's prompt. */
  provider: string | null;
  /** False when no gateway can reach this provider. Cash is always true. */
  available: boolean;
};

export type Payment = {
  id: number;
  booking_id: number;
  method: PaymentMethodId;
  method_label: string;
  provider: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  /** "TWG-8H2K41" - short enough to read down a phone line. */
  reference: string;
  payer_phone: string | null;
  requested_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
};

export type PaymentScreen = {
  booking_id: number;
  route: { origin: string; destination: string };
  departure_at: string | null;
  amount: number;
  currency: string;
  driver: PublicUser;
  methods: PaymentMethodOption[];
  /** The number a request would go to, so nobody types their own back at us. */
  default_phone: string;
  payment: Payment | null;
  settled: boolean;
};

export function paymentFor(token: string, bookingId: number) {
  return request<{ data: PaymentScreen }>(`/bookings/${bookingId}/payment`, {
    token,
  });
}

/**
 * Cash completes here. Mobile money leaves a record awaiting approval and
 * pushes a request to the payer's handset - the answer arrives later, so the
 * caller has to poll `paymentStatus`.
 */
export function payForBooking(
  token: string,
  bookingId: number,
  body: { method: PaymentMethodId; phone?: string },
) {
  return request<{ data: Payment; settled: boolean }>(
    `/bookings/${bookingId}/payment`,
    { method: "POST", token, body },
  );
}

/**
 * Re-reads the record. Deliberately not a "confirm" call: only the provider
 * can say money moved, so this never settles anything on its own.
 */
export function paymentStatus(token: string, paymentId: number) {
  return request<{ data: Payment; settled: boolean }>(
    `/payments/${paymentId}`,
    { token },
  );
}
