import { router, useLocalSearchParams } from "expo-router";
import { Check } from "../../src/icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { myBookings, type Booking } from "../../src/api/bookings";
import { ApiError, NetworkError } from "../../src/api/client";
import {
  pendingRating,
  submitRating,
  type PendingRating,
  type TheirRating,
} from "../../src/api/ratings";
import { RatingCard, type RatingDraft } from "../../src/components/RatingCard";
import { Button } from "../../src/components/ui/Button";
import {
  formatContribution,
  formatDayLabel,
  formatTime,
} from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";

/**
 * Implements "Twogende Trip Complete.dc.html" - the passenger's side.
 *
 * `id` is the booking, not the trip: a passenger's ride is their booking, and
 * the rating hangs off it.
 */
export default function TripComplete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [pending, setPending] = useState<PendingRating | null>(null);
  const [draft, setDraft] = useState<RatingDraft>({
    stars: 0,
    tags: [],
    comment: "",
  });
  const [theirRating, setTheirRating] = useState<TheirRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const [bookingResult, ratingResult] = await Promise.all([
        myBookings(token),
        pendingRating(token, Number(id)),
      ]);

      setBooking(
        bookingResult.data.find((b) => b.id === Number(id)) ?? null,
      );
      setPending(ratingResult);
      setTheirRating(ratingResult.their_rating);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not load this trip.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!token || draft.stars === 0) return;

    setSaving(true);
    setError(null);

    try {
      const result = await submitRating(token, Number(id), {
        stars: draft.stars,
        tags: draft.tags,
        comment: draft.comment.trim() || undefined,
      });

      // Their verdict unseals on submit. Stay on the screen so it can be
      // read - bouncing straight home would throw away the thing that made
      // rating worth doing.
      setTheirRating(result.their_rating);
      setPending((current) => (current ? { ...current, due: false } : current));
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not send your rating.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator style={styles.loader} color={colors.terra} />
      </SafeAreaView>
    );
  }

  const trip = booking?.trip;
  const driver = trip?.driver;
  const done = pending ? !pending.due : false;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.check}>
              <Check size={32} color={colors.onAcacia} strokeWidth={2.6} />
            </View>
            <Text style={styles.title}>Trip complete</Text>
            {trip ? (
              <Text style={styles.route}>
                {trip.origin.name} → {trip.destination.name} ·{" "}
                {formatDayLabel(trip.departure_at)},{" "}
                {formatTime(trip.departure_at)}
              </Text>
            ) : null}
          </View>

          {booking ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You paid</Text>
                <Text style={styles.summaryAmount}>
                  {formatContribution(
                    booking.contribution.total,
                    booking.contribution.currency,
                  )}
                </Text>
              </View>
              <View style={styles.summaryFoot}>
                {/* Cash between two people. Nothing settles through Twogende
                    until the wallet lands, so saying otherwise would be a lie. */}
                <Text style={styles.summaryMeta}>Paid in cash</Text>
                <Text style={styles.summaryMeta}>
                  {booking.seats} {booking.seats === 1 ? "seat" : "seats"}
                </Text>
              </View>
            </View>
          ) : null}

          {pending && driver ? (
            <RatingCard
              question={`How was your ride with ${driver.first_name ?? driver.name}?`}
              subtitle={
                done
                  ? "Thanks - this is what keeps Twogende trustworthy."
                  : "Your rating helps the next passenger choose"
              }
              name={driver.name}
              photoUrl={driver.photo_url}
              tagsByStars={pending.tags}
              chipsBeforeMore={pending.chips_before_more}
              draft={draft}
              onChange={setDraft}
              theirRating={theirRating ?? undefined}
              disabled={done || saving}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.spacer} />

          <View style={styles.actions}>
            {done ? (
              <Button label="Done" onPress={() => router.replace("/(tabs)")} />
            ) : (
              <Button
                label={saving ? "Sending…" : "Submit rating"}
                onPress={() => void submit()}
                disabled={draft.stars === 0 || saving}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  fill: { flex: 1 },
  loader: { marginTop: 80 },
  content: { paddingHorizontal: 24, paddingBottom: 26, flexGrow: 1 },

  hero: { alignItems: "center", paddingTop: 12, paddingBottom: 8 },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.acacia,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.display.bold,
    fontSize: 23,
    letterSpacing: -0.46,
    color: colors.ink,
  },
  route: {
    marginTop: 8,
    fontFamily: fonts.body.medium,
    fontSize: 13.5,
    color: inkTints.meta,
    textAlign: "center",
  },

  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 16,
    marginTop: 6,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    color: inkTints.label,
  },
  summaryAmount: {
    fontFamily: fonts.body.extraBold,
    fontSize: 17,
    color: colors.terra,
  },
  summaryFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summaryMeta: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.placeholder,
  },

  error: {
    marginTop: 14,
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.terraDark,
    textAlign: "center",
  },
  spacer: { flex: 1, minHeight: 20 },
  actions: { marginTop: 20 },
});
