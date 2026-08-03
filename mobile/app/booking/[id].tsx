import { router, useLocalSearchParams } from "expo-router";
import { Check, MessageCircle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { myBookings, type Booking } from "../../src/api/bookings";
import { ApiError, NetworkError } from "../../src/api/client";
import { showTrip } from "../../src/api/trips";
import { Avatar } from "../../src/components/Avatar";
import { formatContribution, formatDayLabel, formatTime } from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";
import type { Trip } from "../../src/types";

/** Implements the "Ride requested" confirmation screen. */
export default function BookingRequested() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const { data } = await myBookings(token);
        const found = data.find((b) => b.id === Number(id)) ?? null;
        setBooking(found);

        if (found) {
          const tripResult = await showTrip(token, found.trip_id);
          setTrip(tripResult.data);
        }
      } catch (e) {
        setError(
          e instanceof ApiError || e instanceof NetworkError
            ? e.message
            : "Could not load your request.",
        );
      }
    })();
  }, [id, token]);

  if (error) {
    return (
      <SafeAreaView style={styles.centre}>
        <Text style={styles.emptyBody}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!booking || !trip) {
    return (
      <SafeAreaView style={styles.centre}>
        <ActivityIndicator color={colors.terra} />
      </SafeAreaView>
    );
  }

  const driver = trip.driver;
  // Resolved server-side so no screen splits a name itself.
  const driverFirstName = driver?.first_name ?? driver?.name ?? "Your driver";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Check size={38} color={colors.onAcacia} strokeWidth={3} />
          </View>
          <Text style={styles.title}>Ride requested</Text>
          <Text style={styles.blurb}>
            {driverFirstName} will confirm your seat shortly.{"\n"}
            You&apos;ll get a notification once accepted.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.driverRow}>
            <Avatar name={driver?.name ?? "?"} photoUrl={driver?.photo_url ?? null} size={44} />
            <View style={styles.driverText}>
              <Text style={styles.driverName} numberOfLines={1}>
                {driver?.name ?? "Driver"}
              </Text>
              <Text style={styles.vehicle} numberOfLines={1}>
                {trip.vehicle?.identifier || "Vehicle details to follow"}
              </Text>
            </View>
          </View>

          <View style={styles.rule} />

          <DetailRow label="Route" value={`${trip.origin.name} → ${trip.destination.name}`} />
          <DetailRow
            label="Departs"
            value={`${formatDayLabel(trip.departure_at)} · ${formatTime(trip.departure_at)}`}
          />
          <DetailRow label="Seats" value={String(booking.seats)} />

          <View style={styles.rule} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatContribution(booking.contribution.total, booking.contribution.currency)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.replace("/(tabs)")}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>Back to home</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({ pathname: "/chat/[id]", params: { id: booking.id } })
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <MessageCircle size={17} color={colors.ink} strokeWidth={2} />
            <Text style={styles.secondaryLabel}>Message your driver</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
    padding: 22,
  },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26 },

  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.acacia,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  title: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    letterSpacing: -0.56,
    color: colors.ink,
  },
  blurb: {
    marginTop: 10,
    textAlign: "center",
    fontFamily: fonts.body.medium,
    fontSize: 14.5,
    lineHeight: 22,
    color: inkTints.tagline,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 16,
  },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  driverText: { flex: 1 },
  driverName: { fontFamily: fonts.body.extraBold, fontSize: 15.5, color: colors.ink },
  vehicle: {
    marginTop: 2,
    fontFamily: fonts.body.regular,
    fontSize: 12.5,
    color: inkTints.label,
  },
  rule: { height: 1, backgroundColor: colors.divider, marginVertical: 14 },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
    gap: 16,
  },
  detailLabel: { fontFamily: fonts.body.regular, fontSize: 13.5, color: inkTints.label },
  detailValue: {
    flexShrink: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    color: colors.ink,
  },

  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { fontFamily: fonts.body.extraBold, fontSize: 14, color: colors.ink },
  totalValue: { fontFamily: fonts.body.extraBold, fontSize: 14, color: colors.terra },

  actions: { marginTop: 22, gap: 10 },
  primary: {
    backgroundColor: colors.terra,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15.5,
    color: colors.onTerra,
  },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    paddingVertical: 16,
  },
  secondaryLabel: { fontFamily: fonts.body.bold, fontSize: 15, color: colors.ink },
  pressed: { transform: [{ translateY: 1 }] },

  emptyBody: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: inkTints.tagline,
    textAlign: "center",
  },
});
