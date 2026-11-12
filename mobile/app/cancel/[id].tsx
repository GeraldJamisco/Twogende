import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, TriangleAlert } from "../../src/icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { bookingsForTrip, type Booking } from "../../src/api/bookings";
import { ApiError, NetworkError } from "../../src/api/client";
import {
  cancelTrip,
  cancellationReasons,
  showTrip,
  type CancellationReason,
} from "../../src/api/trips";
import { formatDayLabel, formatTime } from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";
import type { Trip } from "../../src/types";

/**
 * Implements "Twogende Cancel Ride (Driver).dc.html".
 *
 * A whole screen rather than a confirm dialog, because cancelling strands
 * people at a stage. It should take a moment and it should ask why.
 */
export default function CancelRide() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [confirmed, setConfirmed] = useState(0);
  const [reasons, setReasons] = useState<CancellationReason[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const [tripResult, bookingResult, reasonResult] = await Promise.all([
        showTrip(token, Number(id)),
        bookingsForTrip(token, Number(id)),
        cancellationReasons(token),
      ]);

      setTrip(tripResult.data);
      setConfirmed(
        bookingResult.data.filter((b: Booking) => b.status === "accepted")
          .length,
      );
      setReasons(reasonResult.data);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not load this ride.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm() {
    if (!token || !selected) return;

    setCancelling(true);
    setError(null);

    try {
      await cancelTrip(token, Number(id), selected, note.trim() || undefined);

      // Back to the home screen, not to the ride - the ride no longer exists
      // in any sense a driver would want to look at.
      router.replace("/(tabs)");
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not cancel this ride.",
      );
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator style={styles.loader} color={colors.terra} />
      </SafeAreaView>
    );
  }

  const showOther = selected === "other";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={19} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>Cancel ride</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {trip ? (
            <View style={styles.tripCard}>
              <Text style={styles.tripRoute}>
                {trip.origin.name} → {trip.destination.name}
              </Text>
              <Text style={styles.tripMeta}>
                {formatDayLabel(trip.departure_at)},{" "}
                {formatTime(trip.departure_at)} · {trip.seats.total}{" "}
                {trip.seats.total === 1 ? "seat" : "seats"} offered
              </Text>
            </View>
          ) : null}

          {/* Only when somebody is actually counting on this ride. */}
          {confirmed > 0 ? (
            <View style={styles.warning}>
              <TriangleAlert
                size={16}
                color={colors.terraDark}
                strokeWidth={2.2}
                style={styles.warningIcon}
              />
              <Text style={styles.warningText}>
                {confirmed} {confirmed === 1 ? "passenger" : "passengers"}{" "}
                already confirmed. They&apos;ll be notified immediately.
              </Text>
            </View>
          ) : null}

          <Text style={styles.question}>Why are you cancelling?</Text>
          <Text style={styles.questionSub}>
            This helps us keep the community reliable.
          </Text>

          <View style={styles.reasons}>
            {reasons.map((reason) => {
              const chosen = selected === reason.code;

              return (
                <Pressable
                  key={reason.code}
                  onPress={() => setSelected(reason.code)}
                  style={[styles.reason, chosen && styles.reasonChosen]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chosen }}
                >
                  <View style={[styles.radio, chosen && styles.radioChosen]}>
                    {chosen ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.reasonLabel}>{reason.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* The design opens this under "Other". Passengers never see it - they're told the ride is off, not the driver's private business. */}
          {showOther ? (
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Tell us more…"
              placeholderTextColor={inkTints.inputPlaceholder}
              multiline
              style={styles.note}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.spacer} />

          <View style={styles.actions}>
            <Pressable
              onPress={() => void confirm()}
              disabled={!selected || cancelling}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.confirm,
                (!selected || cancelling) && styles.confirmDisabled,
                pressed && selected && !cancelling && styles.pressed,
              ]}
            >
              <Text style={styles.confirmLabel}>
                {cancelling ? "Cancelling…" : "Cancel ride"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              disabled={cancelling}
              accessibilityRole="button"
              style={styles.keepIt}
            >
              <Text style={styles.keepItLabel}>Never mind, keep it</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // This screen sits on surface rather than cream - the route card inside it
  // is the cream one, which is the inverse of every other screen.
  screen: { flex: 1, backgroundColor: colors.surface },
  fill: { flex: 1 },
  loader: { marginTop: 80 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: colors.ink,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 26,
    flexGrow: 1,
  },

  tripCard: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  tripRoute: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14.5,
    color: colors.ink,
  },
  tripMeta: {
    marginTop: 2,
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.label,
  },

  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: "rgba(192,81,46,0.09)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  warningIcon: { marginTop: 1 },
  warningText: {
    flex: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    lineHeight: 18.75, // 1.5
    color: colors.terraDark,
    textAlign: "center",
  },

  question: {
    fontFamily: fonts.display.bold,
    fontSize: 15,
    color: colors.ink,
    marginTop: 20,
    marginBottom: 4,
  },
  questionSub: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.placeholder,
    marginBottom: 12,
  },

  reasons: { gap: 9 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  reasonChosen: {
    borderColor: colors.terra,
    backgroundColor: "rgba(192,81,46,0.06)",
  },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 2,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  radioChosen: { borderColor: colors.terra, backgroundColor: colors.terra },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.onTerra,
  },
  reasonLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: colors.ink,
  },

  note: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.ink,
    minHeight: 60,
    textAlignVertical: "top",
  },

  error: {
    marginTop: 14,
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.terraDark,
    textAlign: "center",
  },

  spacer: { flex: 1, minHeight: 22 },
  actions: { marginTop: 22, gap: 10 },
  confirm: {
    backgroundColor: colors.terra,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  confirmDisabled: { opacity: 0.45 },
  pressed: { transform: [{ translateY: 1 }] },
  confirmLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15.5,
    color: colors.onTerra,
  },
  keepIt: { padding: 6, alignItems: "center" },
  keepItLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: inkTints.label,
  },
});
