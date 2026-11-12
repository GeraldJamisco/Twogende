import type { UrgencyTone } from "../theme";
import type { Trip } from "../types";

/**
 * How soon a trip leaves, as the badge on the card puts it.
 *
 * Computed on the device rather than sent by the API, so "In 20 min" counts
 * down on its own instead of going stale until the next refresh.
 */
export type Urgency = {
  label: string;
  tone: UrgencyTone;
};

/** Anything leaving within this many minutes reads as "Leaving now". */
const NOW_THRESHOLD_MINUTES = 5;

/** Past this, the countdown switches from minutes to hours. */
const SOON_THRESHOLD_MINUTES = 60;

export function urgencyFor(trip: Trip, now: Date = new Date()): Urgency {
  const departure = new Date(trip.departure_at).getTime();
  const minutes = Math.round((departure - now.getTime()) / 60_000);

  // A trip the driver has started, or one whose time has passed but is still
  // inside the API's grace window - either way the car is already moving.
  if (trip.status === "in_progress" || minutes <= 0) {
    return { label: "On the way", tone: "underway" };
  }

  if (minutes <= NOW_THRESHOLD_MINUTES) {
    return { label: "Leaving now", tone: "now" };
  }

  if (minutes < SOON_THRESHOLD_MINUTES) {
    return { label: `In ${minutes} min`, tone: "soon" };
  }

  const hours = Math.floor(minutes / 60);

  // Beyond a day, hours stop meaning anything - "In 37h" is worse than "In 2d".
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return { label: `In ${days}d`, tone: "later" };
  }

  const remainder = minutes % 60;

  return {
    label: remainder === 0 ? `In ${hours}h` : `In ${hours}h ${remainder}m`,
    tone: "later",
  };
}
