import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Place } from "../api/places";

const KEY = "twogende.recent-searches";
const KEEP = 5;

export type RecentSearch = {
  origin: Place | null;
  destination: Place | null;
  /** When the search was run, for the "Searched yesterday" line. */
  searchedAt: string;
};

/**
 * The "Recent" list on the search screen.
 *
 * Kept on the device rather than the server: it's a convenience for one
 * handset, and a record of everywhere somebody has thought about travelling is
 * not something worth accumulating server-side.
 */
export async function loadRecentSearches(): Promise<RecentSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

export async function rememberSearch(
  origin: Place | null,
  destination: Place | null,
): Promise<void> {
  // A search with neither end is the unfiltered feed, not a route worth
  // remembering.
  if (!origin && !destination) return;

  const entry: RecentSearch = {
    origin,
    destination,
    searchedAt: new Date().toISOString(),
  };

  try {
    const existing = await loadRecentSearches();

    // Re-running an old search moves it to the top rather than duplicating it.
    const deduped = existing.filter(
      (r) =>
        r.origin?.place_id !== origin?.place_id ||
        r.destination?.place_id !== destination?.place_id,
    );

    await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...deduped].slice(0, KEEP)));
  } catch {
    // Losing a recent search is not worth surfacing to anyone.
  }
}

export function describeRoute(search: RecentSearch): string {
  return `${search.origin?.name ?? "Anywhere"} → ${search.destination?.name ?? "Anywhere"}`;
}

/** "Searched yesterday" / "Searched 3 days ago". */
export function describeWhen(search: RecentSearch): string {
  const days = Math.floor(
    (Date.now() - new Date(search.searchedAt).getTime()) / 86_400_000,
  );

  if (days <= 0) return "Searched today";
  if (days === 1) return "Searched yesterday";

  return `Searched ${days} days ago`;
}
