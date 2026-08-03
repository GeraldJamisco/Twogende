/**
 * Thin wrapper over fetch for the Laravel API in ../api.
 *
 * Base URL note: a phone running Expo Go is not the machine running Laravel,
 * so "localhost" resolves to the handset and fails. It has to be this
 * computer's LAN address, and `php artisan serve` has to be listening on
 * 0.0.0.0 rather than 127.0.0.1. See .env / .env.example.
 */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.62:8000/api/v1";

export type ValidationErrors = Record<string, string[]>;

/**
 * A non-2xx response. Carries the API's own message so screens can show what
 * the server actually said rather than a generic failure.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: ValidationErrors = {},
    /** Machine-readable hint, e.g. "phone_unverified", "too_many_attempts". */
    public reason?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** First error for a field, for rendering under an input. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

/** Thrown when the request never reached the server at all. */
export class NetworkError extends Error {
  constructor() {
    super(
      `Could not reach the server at ${BASE_URL}. Check that Laravel is running ` +
        `with --host=0.0.0.0 and that this device is on the same Wi-Fi.`,
    );
    this.name = "NetworkError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  query?: Record<string, string | number | boolean | undefined | null>;
};

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, token, query } = options;

  const url = new URL(BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  // 204s and empty bodies are legitimate.
  const text = await response.text();
  const payload = text ? safeParse(text) : {};

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message ?? `Request failed (${response.status}).`,
      payload?.errors ?? {},
      payload?.reason,
      payload?.retry_after_seconds,
    );
  }

  return payload as T;
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // An HTML error page, usually a Laravel stack trace or a 404 from the
    // wrong base URL. Surface something more useful than "unexpected token".
    return { message: "The server returned an unexpected response." };
  }
}

export const apiBaseUrl = BASE_URL;
