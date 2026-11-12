import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { Car, Check, ChevronLeft, Clock, ShieldCheck } from "../src/icons";
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

import { ApiError, NetworkError } from "../src/api/client";
import type { Place } from "../src/api/places";
import { createTrip, priceSuggestion } from "../src/api/trips";
import { listVehicles } from "../src/api/verification";
import { RouteCard } from "../src/components/RouteCard";
import { formatContribution } from "../src/lib/format";
import { useAuth } from "../src/state/AuthContext";
import { colors, fonts, inkTints } from "../src/theme";
import type { Vehicle } from "../src/types";

type DateChoice = "today" | "tomorrow" | "pick";

/** Implements "Twogende Offer Ride.dc.html" - the form and posted states. */
export default function OfferRide() {
  const { token } = useAuth();

  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);

  const [dateChoice, setDateChoice] = useState<DateChoice>("today");
  const [pickedDate, setPickedDate] = useState<Date>(new Date());
  const [time, setTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState("");

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [suggestion, setSuggestion] = useState<{ low: number; high: number } | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postedTripId, setPostedTripId] = useState<number | null>(null);

  // The design shows the driver's verified car rather than asking them to pick
  // one - publishing is gated on having exactly that.
  useEffect(() => {
    if (!token) return;
    void listVehicles(token)
      .then(({ data }) => setVehicle(data.find((v) => v.verified) ?? data[0] ?? null))
      .catch(() => {});
  }, [token]);

  // Suggested range, once there's a route to suggest for.
  useEffect(() => {
    if (!token || !origin || !destination) {
      setSuggestion(null);
      return;
    }

    void priceSuggestion(token, {
      origin_place_id: origin.place_id,
      destination_place_id: destination.place_id,
    })
      .then((result) => setSuggestion(result.data))
      .catch(() => setSuggestion(null));
  }, [token, origin, destination]);

  const selectedDate = useCallback((): Date => {
    if (dateChoice === "tomorrow") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    return dateChoice === "pick" ? pickedDate : new Date();
  }, [dateChoice, pickedDate]);

  function onDateChosen(event: DateTimePickerEvent, value?: Date) {
    setShowDatePicker(Platform.OS === "ios");
    if (event.type === "set" && value) {
      setPickedDate(value);
      setDateChoice("pick");
    }
  }

  function onTimeChosen(event: DateTimePickerEvent, value?: Date) {
    setShowTimePicker(Platform.OS === "ios");
    if (event.type === "set" && value) setTime(value);
  }

  const contribution = Number(price.replace(/\D/g, "")) || 0;

  // The design's own rule, plus the two things it takes for granted: a place
  // picked from the list, and a verified car to put the seats in.
  const canPublish =
    Boolean(origin) &&
    Boolean(destination) &&
    Boolean(time) &&
    contribution > 0 &&
    Boolean(vehicle?.verified);

  function departureAt(): Date {
    const date = selectedDate();
    const at = new Date(date);
    if (time) at.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return at;
  }

  async function publish() {
    if (!token || !canPublish || !vehicle || !origin || !destination) return;

    setPublishing(true);
    setError(null);

    try {
      const created = await createTrip(token, {
        vehicle_id: vehicle.id,
        origin: {
          place_id: origin.place_id,
          name: origin.name,
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
        destination: {
          place_id: destination.place_id,
          name: destination.name,
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
        departure_at: departureAt().toISOString(),
        seats_total: seats,
        contribution_per_seat: contribution,
      });

      setPostedTripId(created.data.id);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not post your ride.",
      );
    } finally {
      setPublishing(false);
    }
  }

  if (postedTripId !== null) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.postedWrap}>
          <View style={styles.postedHero}>
            <View style={styles.postedBadge}>
              <Check size={36} color={colors.onAcacia} strokeWidth={2.6} />
            </View>
            <Text style={styles.postedTitle}>Ride posted</Text>
            <Text style={styles.postedBlurb}>
              Passengers on this route will see your ride and can request a seat.
            </Text>
          </View>

          <View style={styles.summary}>
            <SummaryRow label="Route" value={`${origin?.name} → ${destination?.name}`} />
            <SummaryRow
              label="Departs"
              value={`${dateLabel(dateChoice, pickedDate)} · ${time ? formatClock(time) : " - "}`}
            />
            <SummaryRow label="Seats offered" value={String(seats)} />
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>Contribution per seat</Text>
              <Text style={styles.summaryTotalValue}>
                {formatContribution(contribution)}
              </Text>
            </View>
          </View>

          <View style={styles.postedActions}>
            <Pressable
              onPress={() =>
                router.replace({ pathname: "/ride/[id]", params: { id: postedTripId } })
              }
              accessibilityRole="button"
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaLabel}>View requests</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace("/(tabs)")}
              accessibilityRole="button"
              style={({ pressed }) => [styles.postedSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.postedSecondaryLabel}>Back to home</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Offer a ride</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <RouteCard
            origin={origin}
            destination={destination}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            originMark="ring"
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>When</Text>

            <View style={styles.dateRow}>
              {(
                [
                  { key: "today", label: "Today" },
                  { key: "tomorrow", label: "Tomorrow" },
                  {
                    key: "pick",
                    label: dateChoice === "pick" ? shortDate(pickedDate) : "Pick date",
                  },
                ] as { key: DateChoice; label: string }[]
              ).map(({ key, label }) => {
                const active = key === dateChoice;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      if (key === "pick") setShowDatePicker((open) => !open);
                      else {
                        setDateChoice(key);
                        setShowDatePicker(false);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                  >
                    <Text style={[styles.dateChipLabel, active && styles.dateChipLabelActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {showDatePicker ? (
              <View style={styles.pickerHolder}>
                <DateTimePicker
                  value={pickedDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date()}
                  onChange={onDateChosen}
                />
              </View>
            ) : null}

            <Pressable
              onPress={() => setShowTimePicker((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel="Choose your departure time"
              style={[styles.timeField, showTimePicker && styles.fieldOpen]}
            >
              <Clock size={17} color={colors.ochre} strokeWidth={2.2} />
              <Text style={styles.timePrompt}>What time do you leave?</Text>
              <Text style={styles.timeValue}>{time ? formatClock(time) : " - "}</Text>
            </Pressable>

            {showTimePicker ? (
              <View style={styles.pickerHolder}>
                <DateTimePicker
                  value={time ?? new Date()}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onTimeChosen}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.seatsCard}>
            <View>
              <Text style={styles.cardTitle}>Seats to offer</Text>
              <Text style={styles.cardBlurb}>Free seats in your car</Text>
            </View>

            <View style={styles.stepper}>
              <Pressable
                onPress={() => setSeats((n) => Math.max(1, n - 1))}
                accessibilityRole="button"
                accessibilityLabel="One fewer seat"
                style={({ pressed }) => [styles.stepMinus, pressed && styles.pressed]}
              >
                <Text style={styles.stepMinusLabel}>−</Text>
              </Pressable>
              <Text style={styles.seatCount}>{seats}</Text>
              <Pressable
                onPress={() => setSeats((n) => Math.min(vehicle?.passenger_seats ?? 6, n + 1))}
                accessibilityRole="button"
                accessibilityLabel="One more seat"
                style={({ pressed }) => [styles.stepPlus, pressed && styles.pressed]}
              >
                <Text style={styles.stepPlusLabel}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.priceCard}>
            {/*
              "Price per seat" in the design; the wording is contribution
              everywhere it reaches a database or an API, because this is
              cost-sharing rather than commercial transport.
            */}
            <Text style={styles.cardTitle}>Contribution per seat</Text>
            <Text style={styles.cardBlurb}>
              {suggestion
                ? `Suggested ${formatContribution(suggestion.low)} - ${formatContribution(suggestion.high)} for this route`
                : "What each passenger chips in towards fuel"}
            </Text>

            <View style={styles.priceField}>
              <Text style={styles.pricePrefix}>USh</Text>
              <TextInput
                value={price}
                onChangeText={(next) => setPrice(next.replace(/\D/g, "").slice(0, 7))}
                keyboardType="number-pad"
                placeholder="15000"
                placeholderTextColor={inkTints.inputPlaceholder}
                accessibilityLabel="Contribution per seat in shillings"
                style={styles.priceInput}
              />
            </View>
          </View>

          <View style={styles.vehicleCard}>
            <View style={styles.vehicleIcon}>
              <Car size={22} color={colors.ink} strokeWidth={2} />
            </View>
            <View style={styles.vehicleText}>
              <Text style={styles.vehicleName} numberOfLines={1}>
                {vehicle ? vehicle.identifier : "No vehicle yet"}
              </Text>
              <Text style={styles.vehicleMeta} numberOfLines={1}>
                {vehicle
                  ? `${vehicle.colour} · ${
                      vehicle.verified ? "Verified vehicle" : "Awaiting verification"
                    }`
                  : "Add a vehicle to offer rides"}
              </Text>
            </View>
            {vehicle?.verified ? (
              <ShieldCheck size={16} color={colors.acacia} strokeWidth={2.4} />
            ) : null}
          </View>

          {vehicle && !vehicle.verified ? (
            <Pressable
              onPress={() => router.push("/verification")}
              accessibilityRole="button"
              style={styles.verifyLink}
            >
              <Text style={styles.verifyLinkLabel}>Finish verification to publish rides</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable
          onPress={publish}
          disabled={!canPublish || publishing}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPublish, busy: publishing }}
          style={({ pressed }) => [
            styles.cta,
            (!canPublish || publishing) && styles.ctaDisabled,
            pressed && canPublish && styles.pressed,
          ]}
        >
          {publishing ? (
            <ActivityIndicator color={colors.onTerra} />
          ) : (
            <Text style={styles.ctaLabel}>Publish ride</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function dateLabel(choice: DateChoice, picked: Date): string {
  if (choice === "today") return "Today";
  if (choice === "tomorrow") return "Tomorrow";
  return shortDate(picked);
}

function shortDate(date: Date): string {
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },

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

  content: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20 },

  errorBanner: {
    backgroundColor: "rgba(192,81,46,0.10)",
    borderRadius: 16,
    padding: 13,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    color: colors.terraDark,
  },

  section: { marginTop: 20 },
  sectionLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: inkTints.placeholder,
  },

  dateRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  dateChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  dateChipActive: { backgroundColor: colors.terra, borderColor: colors.terra },
  dateChipLabel: { fontFamily: fonts.body.bold, fontSize: 13.5, color: colors.ink },
  dateChipLabelActive: { color: colors.onTerra },

  timeField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  fieldOpen: { borderColor: colors.terra },
  timePrompt: {
    flex: 1,
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: "rgba(43,32,24,0.65)",
  },
  timeValue: { fontFamily: fonts.body.extraBold, fontSize: 14.5, color: colors.ink },

  pickerHolder: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },

  seatsCard: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardTitle: { fontFamily: fonts.body.extraBold, fontSize: 15, color: colors.ink },
  cardBlurb: {
    marginTop: 2,
    fontFamily: fonts.body.regular,
    fontSize: 12.5,
    color: inkTints.label,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepMinus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  stepMinusLabel: { fontFamily: fonts.body.extraBold, fontSize: 18, color: colors.ink },
  stepPlus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.terra,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPlusLabel: { fontFamily: fonts.body.extraBold, fontSize: 18, color: colors.onTerra },
  seatCount: {
    fontFamily: fonts.body.extraBold,
    fontSize: 18,
    color: colors.ink,
    minWidth: 10,
    textAlign: "center",
  },

  priceCard: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  priceField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.cream,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pricePrefix: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15,
    color: inkTints.label,
  },
  priceInput: {
    flex: 1,
    fontFamily: fonts.body.extraBold,
    fontSize: 17,
    color: colors.ink,
    padding: 0,
  },

  vehicleCard: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 16,
  },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleText: { flex: 1 },
  vehicleName: { fontFamily: fonts.body.extraBold, fontSize: 14.5, color: colors.ink },
  vehicleMeta: {
    marginTop: 2,
    fontFamily: fonts.body.regular,
    fontSize: 12.5,
    color: inkTints.label,
  },

  verifyLink: { marginTop: 12, alignItems: "center", paddingVertical: 8 },
  verifyLinkLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 14,
    color: colors.acaciaDark,
  },

  footer: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 26,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  cta: {
    backgroundColor: colors.terra,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.45 },
  ctaLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 16,
    letterSpacing: -0.16,
    color: colors.onTerra,
  },
  pressed: { transform: [{ translateY: 1 }] },

  postedWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 26 },
  postedHero: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  postedBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.acacia,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  postedTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 25,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  postedBlurb: {
    marginTop: 10,
    maxWidth: 280,
    textAlign: "center",
    fontFamily: fonts.body.medium,
    fontSize: 14.5,
    lineHeight: 21.75,
    color: inkTints.tagline,
  },

  summary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 16,
    gap: 9,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontFamily: fonts.body.semiBold, fontSize: 13.5, color: inkTints.label },
  summaryValue: { fontFamily: fonts.body.semiBold, fontSize: 13.5, color: colors.ink },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  summaryTotalLabel: { fontFamily: fonts.body.extraBold, fontSize: 13.5, color: colors.ink },
  summaryTotalValue: { fontFamily: fonts.body.extraBold, fontSize: 13.5, color: colors.terra },

  postedActions: { gap: 10, marginTop: 20 },
  postedSecondary: {
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  postedSecondaryLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 15.5,
    color: colors.ink,
  },
});
