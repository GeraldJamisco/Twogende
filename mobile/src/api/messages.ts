import { request } from "./client";
import type { PublicUser } from "../types";

export type MessageKind = "user" | "system" | "location" | "image";

export type Message = {
  id: number;
  body: string | null;
  sender_id: number | null;
  /** 'system' notices come from Twogende and render as a card, not a bubble. */
  kind: MessageKind;
  /** Present on location messages. */
  location: { latitude: number; longitude: number } | null;
  /** Present on image messages. An authorised route, not a public URL. */
  image_url: string | null;
  /** Resolved server-side, so the app never compares ids to pick a side. */
  is_mine: boolean;
  read: boolean;
  sent_at: string | null;
};

export type Conversation = {
  booking_id: number;
  trip_id: number;
  with: PublicUser | null;
  route: string | null;
  departure_at: string | null;
  booking_status: string;
  /** Splits the Chats list into running and ended conversations. */
  chat: { closes_at: string | null; open: boolean };
  last_message: { body: string; sent_at: string | null; is_mine: boolean } | null;
  unread_count: number;
};

/** Every thread this user is part of, most recently active first. */
export function conversations(token: string) {
  return request<{ data: Conversation[] }>("/conversations", { token });
}

/** Reading a thread marks the other side's messages as seen. */
export function messagesFor(token: string, bookingId: number) {
  return request<{ data: Message[] }>(`/bookings/${bookingId}/messages`, { token });
}

export function sendMessage(token: string, bookingId: number, body: string) {
  return request<{ data: Message }>(`/bookings/${bookingId}/messages`, {
    method: "POST",
    token,
    body: { kind: "user", body },
  });
}

/** Drop a pin, so the other person can see exactly where you're standing. */
export function sendLocation(
  token: string,
  bookingId: number,
  point: { latitude: number; longitude: number; label?: string },
) {
  return request<{ data: Message }>(`/bookings/${bookingId}/messages`, {
    method: "POST",
    token,
    body: {
      kind: "location",
      latitude: point.latitude,
      longitude: point.longitude,
      body: point.label ?? null,
    },
  });
}

/**
 * Send a photo. Multipart, so this bypasses the JSON client — and it comes
 * back as an authorised URL rather than a public one.
 */
export async function sendImage(
  token: string,
  bookingId: number,
  uri: string,
  caption?: string,
): Promise<{ data: Message }> {
  const base = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.62:8000/api/v1";

  const extension = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const form = new FormData();
  form.append("kind", "image");
  if (caption) form.append("body", caption);
  form.append("image", {
    uri,
    name: `photo.${extension}`,
    type: extension === "png" ? "image/png" : "image/jpeg",
  } as any);

  const response = await fetch(`${base}/bookings/${bookingId}/messages`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      // Content-Type is left unset so fetch adds the multipart boundary.
    },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message ?? `Could not send that photo (${response.status}).`);
  }

  return payload;
}

/** Chat photos are private, so loading one needs the bearer token. */
export function imageHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
