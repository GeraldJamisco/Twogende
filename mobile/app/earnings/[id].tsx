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

import { ApiError, NetworkError } from "../../src/api/client";
import {
  submitRating,
  tripSummary,
  type TheirRating,
  type TripSummary,
} from "../../src/api/ratings";
import { RatingCard, type RatingDraft } from "../../src/components/RatingCard";
import { Button } from "../../src/components/ui/Button";
import { formatDayLabel, formatTime } from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";

/**
 * Implements "Twogende Trip Complete (Driver).dc.html".
 *
 * `id` is the trip: a driver finishes one journey and may owe a rating to
 * every passenger who was in the car, so this is one screen with a card each.
 */
export default function TripEarnings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [drafts, setDrafts] = useState<Record<number, RatingDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const result = await tripSummary(token, Number(id));
      setSummary(result.data);
      setDrafts(
        Object.fromEntries(
          result.data.passengers.map((p) => [
            p.booking_id,
            { stars: 0, tags: [], comment: "" },
          ]),
        ),
      );
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

  const outstanding = summary?.passengers.filter((p) => p.rating_due) ?? [];
  const rated = outstanding.filter(
    (p) => (drafts[p.booking_id]?.stars ?? 0) > 0,
  );

  async function submitAll() {
    if (!token || !summary || rated.length === 0) return;

    setSaving(true);
    setError(null);

    /*
     * One request per passenger, because each rating is its own record and a
     * driver who rated three of four people should keep those three. A single
     * batch call would make one bad tag lose the lot.
     */
    const revealed: Record<number, TheirRating> = {};
    const failed: string[] = [];

    for (const passenger of rated) {
      const draft = drafts[passenger.booking_id];

      try {
        const result = await submitRating(token, passenger.booking_id, {
          stars: draft.stars,
          tags: draft.tags,
          comment: draft.comment.trim() || undefined,
        });
        revealed[passenger.booking_id] = result.their_rating;
      } catch {
        failed.push(passenger.passenger.first_name ?? passenger.passenger.name);
      }
    }

    setSummary((current) =>
      current
        ? {
            ...current,
            passengers: current.passengers.map((p) =>
              revealed[p.booking_id]
                ? {
                    ...p,
                    rating_due: false,
                    their_rating: revealed[p.booking_id],
                  }
                : p,
            ),
          }
        : current,
    );

    if (failed.length > 0) {
      setError(`Could not send your rating for ${failed.join(", ")}.`);
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator style={styles.loader} color={colors.terra} />
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.error}>{error ?? "Trip not found."}</Text>
      </SafeAreaView>
    );
  }

  const { earnings, currency } = summary;
  const allDone = outstanding.length === 0;

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
            <Text style={styles.route}>
              {summary.route.origin} → {summary.route.destination}
              {summary.departed_at
                ? ` · ${formatDayLabel(summary.departed_at)}, ${formatTime(summary.departed_at)}`
                : ""}
            </Text>
          </View>

          {/* Earnings, itemised per head. The headline is what actually
              reaches the driver, not what passengers handed over. */}
          <View style={styles.card}>
            <View style={styles.earnedRow}>
              <Text style={styles.earnedLabel}>You earned</Text>
              <Text style={styles.earnedAmount}>
                {money(earnings.net, currency)}
              </Text>
            </View>

            <View style={styles.lines}>
              {summary.passengers.map((p) => (
                <View key={p.booking_id} style={styles.line}>
                  <Text style={styles.lineName} numberOfLines={1}>
                    {p.passenger.first_name ?? p.passenger.name}
                  </Text>
                  <Text style={styles.lineFigures}>
                    {money(p.contribution, currency)}{" "}
                    <Text style={styles.lineFee}>
                      − {money(p.service_fee, currency)}
                    </Text>
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.feeNote}>
              Twogende service fee ·{" "}
              {Math.round(earnings.commission_rate * 100)}% per seat
            </Text>

            <View style={styles.cardFoot}>
              <Text style={styles.footMeta}>
                {summary.seats_filled}{" "}
                {summary.seats_filled === 1 ? "seat" : "seats"} filled
              </Text>
              {/* Absent rather than guessed when the driver never pressed start. */}
              {summary.duration_minutes !== null ? (
                <Text style={styles.footMeta}>
                  {summary.duration_minutes} min
                </Text>
              ) : null}
            </View>
          </View>

          {summary.passengers.map((passenger) => (
            <RatingCard
              key={passenger.booking_id}
              question={`How was ${passenger.passenger.first_name ?? passenger.passenger.name} as a passenger?`}
              subtitle={`Picked up at ${passenger.pickup_name}`}
              name={passenger.passenger.name}
              photoUrl={passenger.passenger.photo_url}
              tagsByStars={summary.rating_tags}
              chipsBeforeMore={summary.chips_before_more}
              draft={
                drafts[passenger.booking_id] ?? {
                  stars: 0,
                  tags: [],
                  comment: "",
                }
              }
              onChange={(draft) =>
                setDrafts((current) => ({
                  ...current,
                  [passenger.booking_id]: draft,
                }))
              }
              theirRating={passenger.their_rating}
              disabled={!passenger.rating_due || saving}
            />
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.spacer} />

          <View style={styles.actions}>
            {allDone ? (
              <Button label="Done" onPress={() => router.replace("/(tabs)")} />
            ) : (
              <Button
                label={saving ? "Sending…" : ratingLabel(rated.length)}
                onPress={() => void submitAll()}
                disabled={rated.length === 0 || saving}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ratingLabel(count: number): string {
  return count === 1 ? "Submit rating" : "Submit ratings";
}

/**
 * The earnings card shows exact figures, not the "15k" shorthand used on trip
 * cards - this is money somebody is counting, and rounding it would be wrong.
 */
function money(amount: number, currency: string): string {
  const symbol = currency === "UGX" ? "USh" : currency;

  return `${symbol} ${amount.toLocaleString("en-UG")}`;
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

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 16,
    marginTop: 6,
  },
  earnedRow: { flexDirection: "row", justifyContent: "space-between" },
  earnedLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    color: inkTints.label,
  },
  earnedAmount: {
    fontFamily: fonts.body.extraBold,
    fontSize: 17,
    color: colors.acaciaDark,
  },

  lines: { marginTop: 14, gap: 6 },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  lineName: {
    flex: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    color: inkTints.meta,
  },
  lineFigures: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    color: inkTints.meta,
  },
  lineFee: { color: colors.terraDark },

  feeNote: {
    marginTop: 10,
    fontFamily: fonts.body.semiBold,
    fontSize: 11.5,
    color: inkTints.placeholder,
  },

  cardFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  footMeta: {
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
