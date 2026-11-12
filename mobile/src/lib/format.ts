/**
 * The design writes contributions as "USh 15k". Amounts arrive from the API as
 * whole Ugandan shillings (UGX has no subunit in practice), so this is a pure
 * presentation concern.
 *
 * Always "contribution", never "fare" Twogende is cost-sharing between
 * travellers, not commercial transport.
 */
export function formatContribution(amount: number, currency = "UGX"): string {
  const symbol = currency === "UGX" ? "USh" : currency;

  if (amount < 1000) {
    return `${symbol} ${amount}`;
  }

  const thousands = amount / 1000;

  // 15000 → "15k", 2500 → "2.5k". No trailing ".0".
  const value = Number.isInteger(thousands)
    ? `${thousands}`
    : thousands.toFixed(1);

  return `${symbol} ${value}k`;
}

/**
 * "1 seat" / "2 seats", as shown on the seat pill.
 */
export function formatSeats(seats: number): string {
  return `${seats} ${seats === 1 ? "seat" : "seats"}`;
}

/**
 * "4.9" ratings render to one decimal place even when they're whole, so
 * "5.0" doesn't collapse to "5" and shift the row.
 *
 * A driver with no ratings yet shows "New" rather than "0.0", which would read
 * as a bad driver rather than an unrated one.
 */
export function formatRating(rating: number | null): string {
  return rating === null ? "New" : rating.toFixed(1);
}

/** "214 trips" / "1 trip" / "No trips yet". */
export function formatTripCount(count: number): string {
  if (count === 0) return "No trips yet";
  return `${count} ${count === 1 ? "trip" : "trips"}`;
}

/** "7:30 AM", as the design writes departure times. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Today" / "Tomorrow" / "Mon 4 Aug". */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";

  return date.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * "+256 785 604 703", as the designs write a number.
 *
 * Shared rather than local to one screen: the profile, the settings list and
 * the account row all show the same number and must not disagree about how it
 * is spaced. Anything that is not a full Ugandan E.164 number is handed back
 * untouched rather than mangled.
 */
export function formatInternational(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length !== 12) return e164;

  return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
}
