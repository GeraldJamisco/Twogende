import { request } from "./client";
import type { Me } from "../types";

/**
 * A phone number is the only credential. Requesting a code and verifying it is
 * the whole of both signing in and signing up there is no password and no
 * separate registration call.
 */

export type OtpRequestResult = {
  message: string;
  /** Normalised E.164, which is what the verify call must send back. */
  phone: string;
  /** Which channel carried it "whatsapp" or "sms". */
  channel: string;
  expires_in_minutes: number;
  resend_after_seconds: number;
};

export type OtpVerifyResult = {
  message: string;
  /** True when this code just created the account rather than signing in. */
  is_new: boolean;
  token: string;
  user: Me;
};

export type AccountLookupResult = {
  /** Normalised E.164 — send this back on the OTP call. */
  phone: string;
  /** "0701 234 567", for confirming the number back to the user. */
  phone_display: string;
  exists: boolean;
  /**
   * One word, for "Welcome back, Grace" — the display name the person chose,
   * often a nickname. Never their legal name, which is only ever used for
   * identity verification. Null when the account has never been named.
   */
  greeting_name: string | null;
};

/**
 * Is this number already a Twogende account?
 *
 * Called before a code is sent so a returning user can be greeted by name, and
 * so somebody who mistyped their number can correct it before we pay to text
 * a stranger.
 */
export function lookupAccount(phone: string) {
  return request<AccountLookupResult>('/auth/lookup', { method: 'POST', body: { phone } });
}

/** Sends a code. Also the resend call the server enforces the cooldown. */
export function requestOtp(phone: string) {
  return request<OtpRequestResult>("/auth/otp", {
    method: "POST",
    body: { phone },
  });
}

export function verifyOtp(input: {
  phone: string;
  code: string;
  device_name?: string;
}) {
  return request<OtpVerifyResult>("/auth/otp/verify", {
    method: "POST",
    body: input,
  });
}

export function logout(token: string) {
  return request<{ message: string }>("/auth/logout", {
    method: "POST",
    token,
  });
}

export function me(token: string) {
  return request<{ data: Me }>("/me", { token });
}

/**
 * Edit your own profile. A brand-new account has no name verifying a code
 * creates it so this is where the first one gets set.
 */
export function updateProfile(
  token: string,
  input: { name?: string; bio?: string | null },
) {
  return request<{ data: Me }>("/me", { method: "PATCH", token, body: input });
}
