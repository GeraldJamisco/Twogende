import { router, useFocusEffect } from "expo-router";
import { ChevronRight } from "../icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { activeRide, type Booking } from "../api/bookings";
import { useAuth } from "../state/AuthContext";
import { colors, fonts } from "../theme";

/** How often the bar re-checks while a tab screen is open. */
const POLL_MS = 20_000;

/**
 * The bar that sits directly above the bottom nav for the whole of a journey.
 *
 * Mounted in the tab bar rather than on one screen, so it follows you across
 * Home, Trips, Chats and Profile a ride in progress is worth seeing wherever * you are.
 *
 * Renders nothing when there's no ride, spacing included, so the tabs look
 * untouched the rest of the time. It clears itself when the trip finishes: the
 * server decides what "currently on a ride" means and simply stops answering.
 */
export function ActiveRideBar() {
  const { token } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await activeRide(token);
      setBooking(data);
    } catch {
      // A missing bar is better than an error on the home screen.
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  if (!booking) return null;

  const stage = booking.tracking.stage;
  const name = booking.with?.first_name ?? booking.with?.name ?? "Your driver";
  const arrived = stage === "arrived";

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/tracking/[id]", params: { id: booking.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${headline(stage, name)}. Tap to track your ride.`}
      style={({ pressed }) => [styles.bar, arrived && styles.barArrived, pressed && styles.pressed]}
    >
      <PulsingDot />

      <View style={styles.text}>
        <Text style={styles.headline} numberOfLines={1}>
          {headline(stage, name)}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {booking.trip
            ? `${booking.trip.origin.name} → ${booking.trip.destination.name}`
            : "Tap to track"}
          {booking.tracking.minutes_away !== null && !arrived
            ? ` · ${booking.tracking.minutes_away} min away`
            : ""}
        </Text>
      </View>

      <ChevronRight size={18} color={colors.onTerra} strokeWidth={2.4} />
    </Pressable>
  );
}

function headline(stage: string, name: string): string {
  switch (stage) {
    case "confirmed":
      return "Your seat is confirmed";
    case "en_route":
      return `${name} is on the way`;
    case "arrived":
      return `${name} has arrived`;
    default:
      return "Ride in progress";
  }
}

function PulsingDot() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.dot, { opacity: pulse }]} />;
}

const styles = StyleSheet.create({
  bar: {
    // Own margins rather than a wrapper's padding: the component returns null
    // when there's no ride, and a wrapper would leave a gap above the nav.
    marginHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.terra,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  // Arriving is the moment worth looking up from your phone for.
  barArrived: { backgroundColor: colors.acacia },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onTerra,
  },
  text: { flex: 1 },
  headline: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14,
    color: colors.onTerra,
  },
  detail: {
    marginTop: 1,
    fontFamily: fonts.body.medium,
    fontSize: 12,
    color: colors.onTerra,
    opacity: 0.85,
  },
  pressed: { transform: [{ translateY: 1 }] },
});
