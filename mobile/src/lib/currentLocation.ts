import * as Location from "expo-location";

import { nearestPlace, type Place } from "../api/places";

export type LocationOutcome =
  | { status: "ok"; place: Place }
  | { status: "denied" }
  | { status: "unavailable"; message: string };

/**
 * Resolve where the handset is to a named place.
 *
 * Two steps that can each fail for different reasons, so the caller gets a
 * result it can explain rather than a bare null: permission refused is a
 * different conversation from "we found you but there's nothing named nearby".
 */
export async function resolveCurrentPlace(token: string): Promise<LocationOutcome> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    return { status: "denied" };
  }

  try {
    // Balanced accuracy: finding the nearest stage doesn't need GPS-grade
    // precision, and asking for it costs battery and time.
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { data } = await nearestPlace(
      token,
      position.coords.latitude,
      position.coords.longitude,
    );

    return { status: "ok", place: data };
  } catch {
    return {
      status: "unavailable",
      message: "We could not work out where you are. Please choose a place instead.",
    };
  }
}

/** Whether location was already granted, so we can prefill without prompting. */
export async function hasLocationPermission(): Promise<boolean> {
  const permission = await Location.getForegroundPermissionsAsync();
  return permission.granted;
}
