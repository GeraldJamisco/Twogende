import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, MessageCircle, Phone } from "../../src/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { showBooking, type Booking } from "../../src/api/bookings";
import { ApiError, NetworkError } from "../../src/api/client";
import { Avatar } from "../../src/components/Avatar";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";

/** The four steps across the top, in order. */
const STEPS = ["requested", "confirmed", "en_route", "arrived"] as const;
const STEP_LABELS = ["Requested", "Confirmed", "En route", "Arrived"];

/** How often the screen re-reads the ride while it's open. */
const POLL_MS = 15_000;

/** Implements "Twogende Ride Tracking.dc.html". */
export default function RideTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await showBooking(token, Number(id));
      setBooking(data);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not load this ride.",
      );
    }
  }, [id, token]);

  // Arrival is decided server-side from the driver's position, so the screen
  // has to keep asking rather than waiting for something to tell it.
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  /*
   * A finished ride has nothing left to track - it has something left to
   * settle. Payment hands on to Trip Complete once it is, or straight away if
   * the contribution has already been paid.
   *
   * Replace rather than push, so a back arrow never lands on a dead map.
   */
  useEffect(() => {
    if (booking?.tracking.stage === "completed") {
      router.replace({ pathname: "/payment/[id]", params: { id: booking.id } });
    }
  }, [booking]);

  if (error) {
    return (
      <SafeAreaView style={styles.centre}>
        <Text style={styles.emptyBody}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.centre}>
        <ActivityIndicator color={colors.terra} />
      </SafeAreaView>
    );
  }

  const trip = booking.trip;
  const other = booking.with;
  const stage = booking.tracking.stage;
  const stageIndex = STEPS.indexOf(stage as (typeof STEPS)[number]);
  const arrived = stage === "arrived" || stage === "completed";

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        <RouteSketch />
        <CarMarker moving={stage === "en_route"} />

        <SafeAreaView edges={["top"]} style={styles.mapOverlay}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <ChevronLeft size={19} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <PulsingDot active={!arrived} />
          <Text style={styles.statusHeadline}>{headlineFor(stage, other?.first_name)}</Text>
          {booking.tracking.minutes_away !== null && !arrived ? (
            <Text style={styles.eta}>{booking.tracking.minutes_away} min</Text>
          ) : null}
        </View>
        <Text style={styles.statusSub}>{subtitleFor(stage, other?.first_name)}</Text>

        <View style={styles.steps}>
          {STEPS.map((step, index) => (
            <View
              key={step}
              style={[
                styles.step,
                index < stageIndex && styles.stepDone,
                index === stageIndex && styles.stepCurrent,
              ]}
            />
          ))}
        </View>
        <View style={styles.stepLabels}>
          {STEP_LABELS.map((label) => (
            <Text key={label} style={styles.stepLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.driverCard}>
          <Avatar name={other?.name ?? "?"} photoUrl={other?.photo_url ?? null} size={46} />
          <View style={styles.driverText}>
            <Text style={styles.driverName} numberOfLines={1}>
              {other?.name ?? "Your driver"}
            </Text>
            <Text style={styles.vehicleLine} numberOfLines={1}>
              {trip?.vehicle?.identifier ?? "Vehicle details to follow"}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push({ pathname: "/chat/[id]", params: { id: booking.id } })
            }
            accessibilityRole="button"
            accessibilityLabel="Message your driver"
            style={({ pressed }) => [styles.actionOutline, pressed && styles.pressed]}
          >
            <MessageCircle size={18} color={colors.ink} strokeWidth={2} />
          </Pressable>

          {/* In-app calling isn't built - see LAUNCH-CHECKLIST.md. */}
          <Pressable
            disabled
            accessibilityRole="button"
            accessibilityLabel="Call"
            style={[styles.actionFilled, styles.disabled]}
          >
            <Phone size={18} color={colors.onAcacia} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.rail}>
              <View style={styles.railStart} />
              <View style={styles.railLine} />
              <View style={styles.railEnd} />
            </View>
            <View style={styles.waypoints}>
              <View>
                <Text style={styles.place}>
                  {booking.pickup.name ?? trip?.origin.name ?? "Pickup"}
                </Text>
                <Text style={styles.placeMeta}>Pickup point</Text>
              </View>
              <View>
                <Text style={styles.place}>{trip?.destination.name ?? "Destination"}</Text>
                <Text style={styles.placeMeta}>Drop-off</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.spacer} />

        {/* No reporting flow exists yet - inert, and on the checklist. */}
        <Pressable
          disabled
          accessibilityRole="button"
          style={[styles.report, styles.disabled]}
        >
          <Text style={styles.reportLabel}>Report a problem</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function headlineFor(stage: string, name?: string | null): string {
  switch (stage) {
    case "requested":
      return "Waiting for confirmation";
    case "confirmed":
      return "Seat confirmed";
    case "en_route":
      return `${name ?? "Your driver"} is on the way`;
    case "arrived":
      return `${name ?? "Your driver"} has arrived`;
    default:
      return "Ride complete";
  }
}

function subtitleFor(stage: string, name?: string | null): string {
  switch (stage) {
    case "requested":
      return `${name ?? "Your driver"} will confirm your seat shortly`;
    case "confirmed":
      return "You'll see the car move once the trip starts";
    case "en_route":
      return `${name ?? "Your driver"} is heading to your pickup point`;
    case "arrived":
      return "Head to your pickup point now";
    default:
      return "Thanks for riding with Twogende";
  }
}

/** The stylised route from the design - not a real map. See the note below. */
function RouteSketch() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 390 300" style={StyleSheet.absoluteFill}>
      <Path
        d="M20 260 Q120 180 180 190 T 370 60"
        stroke="#c7b98f"
        strokeWidth={22}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M20 260 Q120 180 180 190 T 370 60"
        stroke={colors.terra}
        strokeWidth={4}
        strokeDasharray="2 10"
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={20} cy={260} r={7} fill={colors.acacia} stroke="#fff" strokeWidth={3} />
      <Circle cx={370} cy={60} r={7} fill={colors.terraDark} stroke="#fff" strokeWidth={3} />
    </Svg>
  );
}

/** The car, with the expanding ring from the design while it's moving. */
function CarMarker({ moving }: { moving: boolean }) {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!moving) return;

    const loop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [moving, ring]);

  return (
    <View style={styles.carMarker}>
      {moving ? (
        <Animated.View
          style={[
            styles.carRing,
            {
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
              transform: [
                { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] }) },
              ],
            },
          ]}
        />
      ) : null}
      <View style={styles.carDot} />
    </View>
  );
}

function PulsingDot({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
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
  }, [active, pulse]);

  return (
    <Animated.View
      style={[styles.statusDot, { opacity: active ? pulse : 1 }, !active && styles.statusDotDone]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    padding: 22,
  },

  /*
   * The design draws a stylised route rather than a live map, and that's what
   * this is. A real map means react-native-maps plus a billed Maps SDK key - * see LAUNCH-CHECKLIST.md.
   */
  map: { height: 300, backgroundColor: "#e0d3b3", overflow: "hidden" },
  mapOverlay: { paddingHorizontal: 20, paddingTop: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  carMarker: { position: "absolute", left: 112, top: 150 },
  carRing: {
    position: "absolute",
    top: -14,
    left: -14,
    right: -14,
    bottom: -14,
    borderRadius: 31,
    backgroundColor: colors.terra,
  },
  carDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.terra,
    borderWidth: 3,
    borderColor: "#fff",
  },

  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.terra },
  statusDotDone: { backgroundColor: colors.acacia },
  statusHeadline: {
    flex: 1,
    fontFamily: fonts.display.bold,
    fontSize: 19,
    letterSpacing: -0.38,
    color: colors.ink,
  },
  eta: { fontFamily: fonts.body.extraBold, fontSize: 14, color: colors.terra },
  statusSub: {
    marginTop: 4,
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: inkTints.label,
  },

  steps: { flexDirection: "row", gap: 4, marginTop: 18, marginBottom: 4 },
  step: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.divider },
  stepDone: { backgroundColor: colors.acacia },
  stepCurrent: { backgroundColor: colors.terra },
  stepLabels: { flexDirection: "row", justifyContent: "space-between" },
  stepLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: inkTints.notYet,
  },

  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cream,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  driverText: { flex: 1 },
  driverName: { fontFamily: fonts.body.extraBold, fontSize: 15, color: colors.ink },
  vehicleLine: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.label,
  },
  actionOutline: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  actionFilled: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.acacia,
    alignItems: "center",
    justifyContent: "center",
  },

  routeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },
  routeRow: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", gap: 2, paddingTop: 4 },
  railStart: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: colors.acacia,
  },
  railLine: { width: 2, flex: 1, backgroundColor: colors.divider },
  railEnd: { width: 9, height: 9, borderRadius: 2, backgroundColor: colors.terra },
  waypoints: { flex: 1, gap: 14 },
  place: { fontFamily: fonts.body.extraBold, fontSize: 14.5, color: colors.ink },
  placeMeta: { fontFamily: fonts.body.semiBold, fontSize: 12, color: inkTints.label },

  spacer: { flex: 1, minHeight: 18 },
  report: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(192,81,46,0.3)",
    alignItems: "center",
  },
  reportLabel: { fontFamily: fonts.body.bold, fontSize: 13.5, color: colors.terraDark },

  pressed: { transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.45 },
  emptyBody: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: inkTints.tagline,
    textAlign: "center",
  },
});
