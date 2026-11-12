import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ShieldCheck } from "../../src/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  acceptBooking,
  bookingsForTrip,
  rejectBooking,
  type Booking,
} from "../../src/api/bookings";
import { ApiError, NetworkError } from "../../src/api/client";
import { completeTrip, showTrip, startTrip } from "../../src/api/trips";
import { Avatar } from "../../src/components/Avatar";
import { formatContribution, formatDayLabel, formatTime } from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";
import type { Trip } from "../../src/types";

/** Implements "Twogende Ride Posted.dc.html" - the driver's view of their trip. */
export default function RidePosted() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  /** Separate from booking responses: this one blocks the banner action. */
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const [tripResult, bookingResult] = await Promise.all([
        showTrip(token, Number(id)),
        bookingsForTrip(token, Number(id)),
      ]);
      setTrip(tripResult.data);
      setBookings(bookingResult.data);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not load this ride.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(booking: Booking, accept: boolean) {
    if (!token) return;
    setBusyId(booking.id);

    try {
      if (accept) await acceptBooking(token, booking.id);
      else await rejectBooking(token, booking.id);

      // Reload rather than patch locally: accepting changes the seat count on
      // the trip too, and that has to come from the server.
      await load();
    } catch (e) {
      Alert.alert(
        accept ? "Could not accept" : "Could not decline",
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Setting off, and finishing.
   *
   * These are the only two calls that move a trip through its lifecycle, and
   * until now nothing in the app made them - which left every screen after a
   * ride unreachable: payment, both rating screens, the earnings summary.
   *
   * `complete()` is the one event that closes the bookings, fixes the
   * commission on each seat and unlocks ratings, all in one transaction. It
   * cannot be undone, so it asks first. Starting is harmless and does not.
   */
  async function begin() {
    if (!token || !trip) return;

    setLifecycleBusy(true);
    try {
      await startTrip(token, trip.id);
      await load();
    } catch (e) {
      Alert.alert(
        "Could not start the trip",
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Please try again.",
      );
    } finally {
      setLifecycleBusy(false);
    }
  }

  function confirmFinish() {
    if (!trip) return;

    const riders = bookings.filter((b) => b.status === "accepted").length;

    Alert.alert(
      "Finish this trip?",
      riders > 0
        ? `${riders} ${riders === 1 ? "passenger" : "passengers"} will be asked to pay and rate you. This can't be undone.`
        : "This can't be undone.",
      [
        { text: "Not yet", style: "cancel" },
        { text: "Finish trip", style: "destructive", onPress: () => void finish() },
      ],
    );
  }

  async function finish() {
    if (!token || !trip) return;

    setLifecycleBusy(true);
    try {
      await completeTrip(token, trip.id);

      // Straight to the payoff: what the ride earned, and a rating card per
      // passenger. It is the only moment a driver reliably rates anyone.
      router.replace({ pathname: "/earnings/[id]", params: { id: trip.id } });
    } catch (e) {
      Alert.alert(
        "Could not finish the trip",
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Please try again.",
      );
      setLifecycleBusy(false);
    }
  }

  /*
   * A confirm dialog used to stand in for this. Cancelling strands people at
   * a stage, and the reason is worth collecting, so it gets its own screen.
   */
  function goToCancel() {
    if (!trip) return;
    router.push({ pathname: "/cancel/[id]", params: { id: trip.id } });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centre}>
        <ActivityIndicator color={colors.terra} />
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.centre}>
        <Text style={styles.emptyBody}>{error ?? "This ride could not be found."}</Text>
      </SafeAreaView>
    );
  }

  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter(
    (b) => b.status === "accepted" || b.status === "completed",
  );

  const seatsFilled = trip.seats.total - trip.seats.available;
  const collected = confirmed.reduce((sum, b) => sum + b.contribution.total, 0);
  const live = trip.status === "scheduled" || trip.status === "in_progress";

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          >
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.title}>Your ride</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.terra}
            />
          }
        >
          <StatusBanner
            live={live}
            status={trip.status}
            route={`${trip.origin.name} → ${trip.destination.name}`}
            when={`${formatDayLabel(trip.departure_at)} ${formatTime(trip.departure_at)}`}
            departureAt={trip.departure_at}
            busy={lifecycleBusy}
            onStart={begin}
            onFinish={confirmFinish}
          />

          <View style={styles.summary}>
            <View style={styles.summaryRoute}>
              <View style={styles.rail}>
                <View style={styles.railStart} />
                <View style={styles.railLine} />
                <View style={styles.railEnd} />
              </View>

              <View style={styles.waypoints}>
                <View>
                  <Text style={styles.place}>{trip.origin.name}</Text>
                  <Text style={styles.placeMeta}>
                    Departs {formatTime(trip.departure_at)} ·{" "}
                    {formatDayLabel(trip.departure_at)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.place}>{trip.destination.name}</Text>
                  {/*
                    The design shows an estimated arrival. Nothing in the
                    schema knows one, and a guessed ETA on Kampala roads is
                    worse than none - see the handover note.
                  */}
                </View>
              </View>
            </View>

            <View style={styles.stats}>
              <Stat value={`${seatsFilled}/${trip.seats.total}`} label="seats filled" />
              <Stat
                value={formatContribution(trip.contribution.per_seat, trip.contribution.currency)}
                label="per seat"
                accent
                divided
              />
              <Stat
                value={formatContribution(collected, trip.contribution.currency)}
                label="contributions"
                divided
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {pending.length} pending {pending.length === 1 ? "request" : "requests"}
            </Text>

            {pending.length === 0 ? (
              <Text style={styles.sectionEmpty}>
                Nobody is waiting on an answer right now.
              </Text>
            ) : (
              <View style={styles.requests}>
                {pending.map((booking) => (
                  <RequestCard
                    key={booking.id}
                    booking={booking}
                    fallbackPickup={trip.origin.name}
                    busy={busyId === booking.id}
                    onAccept={() => respond(booking, true)}
                    onDecline={() => respond(booking, false)}
                  />
                ))}
              </View>
            )}
          </View>

          {confirmed.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Confirmed</Text>
              <View style={styles.confirmedList}>
                {confirmed.map((booking) => (
                  <View key={booking.id} style={styles.confirmedRow}>
                    <Avatar
                      name={booking.passenger?.name ?? "?"}
                      photoUrl={booking.passenger?.photo_url ?? null}
                      size={36}
                    />
                    <View style={styles.confirmedText}>
                      <Text style={styles.confirmedName} numberOfLines={1}>
                        {booking.passenger?.name ?? "Passenger"}
                      </Text>
                      <Text style={styles.confirmedMeta} numberOfLines={1}>
                        {booking.seats} {booking.seats === 1 ? "seat" : "seats"} ·{" "}
                        {booking.pickup.name ?? trip.origin.name}
                      </Text>
                    </View>
                    <View style={styles.confirmedBadge}>
                      <Text style={styles.confirmedBadgeLabel}>Confirmed</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {/*
            Editing a live ride has no design yet, so the button says what it
            is rather than pretending to work.
          */}
          <Pressable
            disabled
            accessibilityRole="button"
            style={[styles.footerButton, styles.footerButtonDisabled]}
          >
            <Text style={styles.footerButtonLabel}>Edit ride</Text>
          </Pressable>

          <Pressable
            onPress={goToCancel}
            disabled={!live}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.footerButton,
              styles.footerButtonDanger,
              !live && styles.footerButtonDisabled,
              pressed && live && styles.pressed,
            ]}
          >
            <Text style={[styles.footerButtonLabel, styles.footerButtonDangerLabel]}>
              Cancel ride
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** The acacia banner, with the pulsing dot from the design. */
function StatusBanner({
  live,
  status,
  route,
  when,
  departureAt,
  busy,
  onStart,
  onFinish,
}: {
  live: boolean;
  status: Trip["status"];
  route: string;
  when: string;
  departureAt: string;
  busy: boolean;
  onStart: () => void;
  onFinish: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!live) return;

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
  }, [live, pulse]);

  const headline = live
    ? status === "in_progress"
      ? "Under way"
      : "Live · visible to passengers"
    : status === "completed"
      ? "Completed"
      : "Cancelled";

  /*
   * The server won't start or finish a trip before its departure time has
   * passed (TripPolicy::complete), so the button stays away until then rather
   * than appearing and being refused. A driver looking at a ride they publish
   * for tomorrow has nothing to do here yet, and the banner says so.
   */
  const departed = new Date(departureAt).getTime() <= Date.now();

  const action =
    status === "in_progress"
      ? { label: "Finish", onPress: onFinish }
      : status === "scheduled" && departed
        ? { label: "Start trip", onPress: onStart }
        : null;

  return (
    <View style={[styles.banner, !live && styles.bannerQuiet]}>
      <Animated.View style={[styles.bannerDot, { opacity: live ? pulse : 0.5 }]} />
      <View style={styles.bannerText}>
        <Text style={styles.bannerHeadline}>{headline}</Text>
        <Text style={styles.bannerMeta} numberOfLines={1}>
          {route} · {when}
        </Text>
      </View>

      {action ? (
        <Pressable
          onPress={action.onPress}
          disabled={busy}
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => [
            styles.bannerAction,
            busy && styles.bannerActionBusy,
            pressed && !busy && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.acaciaDark} />
          ) : (
            <Text style={styles.bannerActionLabel}>{action.label}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function Stat({
  value,
  label,
  accent,
  divided,
}: {
  value: string;
  label: string;
  accent?: boolean;
  divided?: boolean;
}) {
  return (
    <View style={[styles.stat, divided && styles.statDivided]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RequestCard({
  booking,
  fallbackPickup,
  busy,
  onAccept,
  onDecline,
}: {
  booking: Booking;
  fallbackPickup: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.request}>
      <View style={styles.requestTop}>
        <Avatar
          name={booking.passenger?.name ?? "?"}
          photoUrl={booking.passenger?.photo_url ?? null}
          size={40}
        />

        <View style={styles.requestText}>
          <View style={styles.requestNameRow}>
            <Text style={styles.requestName} numberOfLines={1}>
              {booking.passenger?.name ?? "Passenger"}
            </Text>
            {booking.passenger?.verification.identity ? (
              <ShieldCheck size={12} color={colors.acacia} strokeWidth={2.6} />
            ) : null}
          </View>
          <Text style={styles.requestMeta} numberOfLines={1}>
            {booking.seats} {booking.seats === 1 ? "seat" : "seats"} ·{" "}
            {booking.pickup.name ?? fallbackPickup}
          </Text>
        </View>

        <Text style={styles.requestTotal}>
          {formatContribution(booking.contribution.total, booking.contribution.currency)}
        </Text>
      </View>

      <View style={styles.requestActions}>
        <Pressable
          onPress={onDecline}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.decline,
            pressed && !busy && styles.pressed,
            busy && styles.actionBusy,
          ]}
        >
          <Text style={styles.declineLabel}>Decline</Text>
        </Pressable>

        <Pressable
          onPress={onAccept}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.accept,
            pressed && !busy && styles.pressed,
            busy && styles.actionBusy,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.onAcacia} />
          ) : (
            <Text style={styles.acceptLabel}>Accept</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
    padding: 22,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 4,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { backgroundColor: colors.divider },
  title: {
    fontFamily: fonts.display.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.ink,
  },

  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 20 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.acacia,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bannerQuiet: { backgroundColor: "rgba(43,32,24,0.35)" },
  bannerDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.onAcacia,
  },
  bannerText: { flex: 1 },
  /*
   * A cream pill on the acacia banner. The app's primary terracotta would
   * fight the green it sits on; this reads as the one thing to press without
   * introducing a colour the banner doesn't already own.
   */
  bannerAction: {
    backgroundColor: colors.onAcacia,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 78,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerActionBusy: { opacity: 0.6 },
  bannerActionLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 13,
    color: colors.acaciaDark,
  },
  bannerHeadline: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14.5,
    color: colors.onAcacia,
  },
  bannerMeta: {
    marginTop: 1,
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.onAcacia,
    opacity: 0.85,
  },

  summary: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 16,
  },
  summaryRoute: { flexDirection: "row", gap: 12 },
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
  place: { fontFamily: fonts.body.extraBold, fontSize: 15, color: colors.ink },
  placeMeta: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    color: inkTints.label,
  },

  stats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  stat: { flex: 1, alignItems: "center" },
  statDivided: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  statValue: { fontFamily: fonts.body.extraBold, fontSize: 16, color: colors.ink },
  statValueAccent: { color: colors.terra },
  statLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 11,
    color: inkTints.label,
  },

  section: { marginTop: 22 },
  sectionLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: inkTints.placeholder,
  },
  sectionEmpty: {
    marginTop: 10,
    fontFamily: fonts.body.regular,
    fontSize: 13.5,
    color: inkTints.label,
  },

  requests: { gap: 10, marginTop: 10 },
  request: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    padding: 13,
    backgroundColor: colors.surface,
  },
  requestTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  requestText: { flex: 1 },
  requestNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  requestName: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14.5,
    color: colors.ink,
    flexShrink: 1,
  },
  requestMeta: {
    marginTop: 1,
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: inkTints.label,
  },
  requestTotal: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14,
    color: colors.terra,
  },

  requestActions: { flexDirection: "row", gap: 8, marginTop: 11 },
  decline: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: "center",
  },
  declineLabel: { fontFamily: fonts.body.bold, fontSize: 13, color: colors.ink },
  accept: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: colors.acacia,
    alignItems: "center",
  },
  acceptLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 13,
    color: colors.onAcacia,
  },
  actionBusy: { opacity: 0.6 },

  confirmedList: { marginTop: 8 },
  confirmedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  confirmedText: { flex: 1 },
  confirmedName: { fontFamily: fonts.body.bold, fontSize: 14, color: colors.ink },
  confirmedMeta: {
    fontFamily: fonts.body.regular,
    fontSize: 11.5,
    color: inkTints.placeholder,
  },
  confirmedBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: "rgba(108,122,69,0.16)",
  },
  confirmedBadgeLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    color: colors.acaciaDark,
  },

  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 20,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: "center",
  },
  footerButtonDisabled: { opacity: 0.45 },
  footerButtonDanger: { borderColor: "rgba(192,81,46,0.35)" },
  footerButtonLabel: { fontFamily: fonts.body.bold, fontSize: 14, color: colors.ink },
  footerButtonDangerLabel: { color: colors.terraDark },
  pressed: { transform: [{ translateY: 1 }] },

  emptyBody: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: inkTints.tagline,
    textAlign: "center",
  },
});
