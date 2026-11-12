import { request } from "./client";
import type { Me } from "../types";

/**
 * Settings-screen calls: the notification switches, closing an account, and
 * the platform values the legal copy must agree with.
 */

/** One way to pay. `available` is asked of the gateway, never assumed. */
export type PaymentMethodOption = {
  key: string;
  label: string;
  note: string;
  available: boolean;
};

export type PlatformConfig = {
  /** 0.20 for 20%. Read, never hard-coded - the admin dashboard will own it. */
  commission_rate: number;
  currency: string;
  support_email: string;
  privacy_email: string;
  /**
   * Every way Twogende will ever take a contribution, working or not. The
   * settings screen shows this constant list; which one is actually used is
   * chosen per trip on the payment screen.
   */
  payment_methods: PaymentMethodOption[];
};

export function platformConfig(token: string) {
  return request<{ data: PlatformConfig }>("/config", { token });
}

/**
 * Ride updates default on - they are the messages a booking is useless
 * without. Marketing defaults off, because consent under the Data Protection
 * and Privacy Act is given rather than assumed.
 */
export function updateNotifications(
  token: string,
  body: { notify_ride_updates?: boolean; notify_marketing?: boolean },
) {
  return request<{ data: Me }>("/me/notifications", {
    method: "PATCH",
    token,
    body,
  });
}

/**
 * Closes the account.
 *
 * Server-side this cancels every ride the user was driving (telling those
 * passengers), releases the seats they were holding, and revokes every token
 * on every device - not just this one.
 */
export function deleteAccount(token: string, reason?: string) {
  return request<{ message: string }>("/me", {
    method: "DELETE",
    token,
    body: { reason },
  });
}
