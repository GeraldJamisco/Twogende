import { request } from './client';
import type { Vehicle } from '../types';

export type IdentitySubmission = {
  id: number;
  document_type: 'national_id' | 'passport' | 'driving_permit';
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export function identityStatus(token: string) {
  return request<{ data: IdentitySubmission | null; identity_verified: boolean }>('/me/identity', {
    token,
  });
}

export function listVehicles(token: string) {
  return request<{ data: Vehicle[] }>('/vehicles', { token });
}

/**
 * Multipart uploads, so these bypass the JSON client.
 *
 * The API is reached over the LAN address in EXPO_PUBLIC_API_URL — see
 * src/api/client.ts for why "localhost" doesn't work from a handset.
 */
async function upload<T>(path: string, token: string, form: FormData): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.62:8000/api/v1';

  const response = await fetch(base + path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      // Content-Type is deliberately unset: fetch has to add the multipart
      // boundary itself, and setting it by hand breaks the upload.
    },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message ?? `Upload failed (${response.status}).`) as Error & {
      status: number;
      errors: Record<string, string[]>;
    };
    error.status = response.status;
    error.errors = payload?.errors ?? {};
    throw error;
  }

  return payload as T;
}

export type IdentityInput = {
  fullName: string;
  dateOfBirth: string;
  idType: 'license' | 'national' | 'passport';
  idNumber: string;
  idPhotoUri: string;
  selfieUri: string;
};

export function submitIdentity(token: string, input: IdentityInput) {
  const form = new FormData();
  form.append('full_name', input.fullName);
  form.append('date_of_birth', input.dateOfBirth);
  form.append('id_type', input.idType);
  form.append('id_number', input.idNumber);
  form.append('id_photo', asFilePart(input.idPhotoUri, 'id'));
  form.append('selfie', asFilePart(input.selfieUri, 'selfie'));

  return upload<{ data: IdentitySubmission }>('/me/identity', token, form);
}

export type VehicleInput = {
  makeAndModel: string;
  colour: string;
  plateLast4: string;
  photoUri: string;
  passengerSeats?: number;
};

export function submitVehicle(token: string, input: VehicleInput) {
  const form = new FormData();
  form.append('make_and_model', input.makeAndModel);
  form.append('colour', input.colour);
  form.append('plate_last4', input.plateLast4);
  form.append('photo', asFilePart(input.photoUri, 'vehicle'));
  if (input.passengerSeats) form.append('passenger_seats', String(input.passengerSeats));

  return upload<{ data: Vehicle }>('/vehicles', token, form);
}

/** React Native's FormData takes {uri, name, type} rather than a Blob. */
function asFilePart(uri: string, name: string): any {
  const extension = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const type = extension === 'png' ? 'image/png' : 'image/jpeg';

  return { uri, name: `${name}.${extension}`, type };
}
