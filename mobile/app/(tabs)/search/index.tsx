import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, Clock, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Place } from "../../../src/api/places";
import { RouteCard } from "../../../src/components/RouteCard";
import {
  describeRoute,
  describeWhen,
  loadRecentSearches,
  rememberSearch,
  type RecentSearch,
} from "../../../src/lib/recentSearches";
import { colors, fonts, inkTints } from "../../../src/theme";

type DateChoice = "today" | "tomorrow" | "pick";

/** Implements "Twogende Search.dc.html". */
export default function SearchForm() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);

  const [dateChoice, setDateChoice] = useState<DateChoice>("today");
  const [pickedDate, setPickedDate] = useState<Date>(new Date());
  const [time, setTime] = useState<Date | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [seats, setSeats] = useState(1);
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  useFocusEffect(
    useCallback(() => {
      void loadRecentSearches().then(setRecent);
    }, []),
  );

  function selectedDate(): Date {
    if (dateChoice === "today") return new Date();
    if (dateChoice === "tomorrow") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    return pickedDate;
  }

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

  async function submit(
    from: Place | null = origin,
    to: Place | null = destination,
  ) {
    await rememberSearch(from, to);

    const date = selectedDate();

    // The time filter is an absolute moment, so it's combined with whichever
    // day is selected rather than sent as a bare clock time.
    let after: string | undefined;
    if (time) {
      const combined = new Date(date);
      combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
      after = combined.toISOString();
    }

    router.push({
      pathname: "/(tabs)/search/results",
      params: {
        originPlaceId: from?.place_id ?? "",
        originName: from?.name ?? "",
        originLat: from ? String(from.latitude) : "",
        originLng: from ? String(from.longitude) : "",
        destinationPlaceId: to?.place_id ?? "",
        destinationName: to?.name ?? "",
        destinationLat: to ? String(to.latitude) : "",
        destinationLng: to ? String(to.longitude) : "",
        date: date.toISOString().slice(0, 10),
        after: after ?? "",
        seats: String(seats),
      },
    });
  }

  const dateOptions: { key: DateChoice; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "pick", label: dateChoice === "pick" ? formatShortDate(pickedDate) : "Pick date" },
  ];

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push("/(tabs)")}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Find a ride</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <RouteCard
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>When</Text>

          <View style={styles.dateRow}>
            {dateOptions.map(({ key, label }) => {
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

          {/* Directly under the chip that opened it, not adrift at the
              bottom of the screen. */}
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
            accessibilityLabel={
              time
                ? `Leaving from ${formatClock(time)}. Tap to change.`
                : "Any time. Tap to choose a departure time."
            }
            style={[styles.timeField, showTimePicker && styles.timeFieldOpen]}
          >
            <Clock size={17} color={colors.ochre} strokeWidth={2.2} />
            <Text style={styles.timePrompt}>What time do you want to leave?</Text>
            <Text style={styles.timeValue}>{time ? formatClock(time) : "Any"}</Text>

            {/*
              A chosen time has to be undoable — otherwise "any time" is a
              state you can only reach by leaving the screen.
            */}
            {time ? (
              <Pressable
                onPress={() => setTime(null)}
                accessibilityRole="button"
                accessibilityLabel="Clear the time, search any time"
                hitSlop={10}
              >
                <X size={15} color={inkTints.placeholder} strokeWidth={2.2} />
              </Pressable>
            ) : null}
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
            <Text style={styles.seatsTitle}>Seats needed</Text>
            <Text style={styles.seatsBlurb}>How many are travelling</Text>
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
              onPress={() => setSeats((n) => Math.min(6, n + 1))}
              accessibilityRole="button"
              accessibilityLabel="One more seat"
              style={({ pressed }) => [styles.stepPlus, pressed && styles.pressed]}
            >
              <Text style={styles.stepPlusLabel}>+</Text>
            </Pressable>
          </View>
        </View>

        {recent.length > 0 ? (
          <View style={styles.recentSection}>
            <Text style={styles.sectionLabel}>Recent</Text>
            <View style={styles.recentList}>
              {recent.map((search, index) => (
                <Pressable
                  key={`${search.searchedAt}-${index}`}
                  onPress={() => {
                    // Fill the form and go — a recent search is a search
                    // somebody already decided on, so making them tap
                    // "Search rides" again is a step for nothing.
                    setOrigin(search.origin);
                    setDestination(search.destination);
                    void submit(search.origin, search.destination);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.recentRow, pressed && styles.recentPressed]}
                >
                  <View style={styles.recentIcon}>
                    <Clock size={16} color={colors.ink} strokeWidth={2} />
                  </View>
                  <View style={styles.recentText}>
                    <Text style={styles.recentRoute} numberOfLines={1}>
                      {describeRoute(search)}
                    </Text>
                    <Text style={styles.recentWhen}>{describeWhen(search)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          // Wrapped, not passed directly: Pressable hands its press event to
          // the first argument, which is now the origin place.
          onPress={() => void submit()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Text style={styles.ctaLabel}>Search rides</Text>
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

/** "4 Aug" for the picked-date chip. */
function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },

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
    fontSize: 21,
    letterSpacing: -0.42,
    color: colors.ink,
  },

  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 },

  section: { marginTop: 22 },
  sectionLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 1.1, // 0.1em at 11px
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
  timeFieldOpen: { borderColor: colors.terra },
  pickerHolder: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  timePrompt: {
    flex: 1,
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: "rgba(43,32,24,0.65)",
  },
  timeValue: { fontFamily: fonts.body.extraBold, fontSize: 14.5, color: colors.ink },

  seatsCard: {
    marginTop: 22,
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
  seatsTitle: { fontFamily: fonts.body.extraBold, fontSize: 15, color: colors.ink },
  seatsBlurb: {
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

  recentSection: { marginTop: 26 },
  recentList: { marginTop: 8 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  recentPressed: { backgroundColor: colors.cream },
  recentIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  recentText: { flex: 1 },
  recentRoute: { fontFamily: fonts.body.bold, fontSize: 14.5, color: colors.ink },
  recentWhen: {
    marginTop: 1,
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: inkTints.placeholder,
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
  ctaLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 18,
    letterSpacing: -0.18,
    color: colors.onTerra,
  },
  pressed: { transform: [{ translateY: 1 }] },
});
