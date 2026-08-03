import { ShieldCheck, Star } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  formatContribution,
  formatDayLabel,
  formatRating,
  formatSeats,
  formatTime,
  formatTripCount,
} from "../lib/format";
import { urgencyFor } from "../lib/urgency";
import {
  colors,
  fonts,
  inkTints,
  seatBadgeTones,
  urgencyTones,
} from "../theme";
import type { Trip } from "../types";
import { Avatar } from "./Avatar";

type Props = {
  trip: Trip;
  onPress?: (trip: Trip) => void;
};

/**
 * The ride card from "Twogende Search Results.dc.html", used on both the home
 * feed and search results.
 *
 * Departure only — there is no arrival time. A driver can't reliably promise
 * one on Kampala roads, so the design shows when the car leaves and lets the
 * urgency pill carry the rest.
 */
export function TripCard({ trip, onPress }: Props) {
  const { driver, origin, destination, seats } = trip;

  const urgency = urgencyFor(trip);
  const urgencyTone = urgencyTones[urgency.tone];

  // The mockups vary this pill with no rule behind it, so everything uses the
  // default tone until there is one.
  const seatTone = seatBadgeTones.acacia;

  // The design writes "Departs 7:30 AM". The home feed mixes days, so the day
  // is added only when it isn't today.
  const dayLabel = formatDayLabel(trip.departure_at);
  const departsAt =
    dayLabel === "Today"
      ? formatTime(trip.departure_at)
      : `${dayLabel} ${formatTime(trip.departure_at)}`;

  return (
    <Pressable
      onPress={() => onPress?.(trip)}
      accessibilityRole="button"
      accessibilityLabel={
        `${driver?.name ?? "Driver"}. ${origin.name} to ${destination.name}, departs ${departsAt}, ${urgency.label}. ` +
        `${formatContribution(trip.contribution.per_seat, trip.contribution.currency)} per seat, ` +
        `${formatSeats(seats.available)} left.`
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.driverRow}>
        <Avatar name={driver?.name ?? "?"} photoUrl={driver?.photo_url ?? null} />

        <View style={styles.driverDetails}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {driver?.name ?? "Driver"}
            </Text>
            {driver?.verification.identity ? (
              <ShieldCheck size={13} color={colors.acacia} strokeWidth={2.4} />
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Star size={13} color={colors.ochre} fill={colors.ochre} strokeWidth={0} />
            <Text style={styles.meta}>
              {formatRating(driver?.reputation.rating_as_driver ?? null)} ·{" "}
              {formatTripCount(driver?.reputation.trips_as_driver ?? 0)}
            </Text>
          </View>
        </View>

        <View style={styles.contribution}>
          <Text style={styles.contributionAmount}>
            {formatContribution(trip.contribution.per_seat, trip.contribution.currency)}
          </Text>
          <Text style={styles.contributionUnit}>per seat</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.originDot} />

        <View style={styles.routeText}>
          <Text style={styles.route} numberOfLines={1}>
            {origin.name} → {destination.name}
          </Text>
          <Text style={styles.departs} numberOfLines={1}>
            Departs {departsAt}
          </Text>
        </View>

        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: urgencyTone.background }]}>
            {urgencyTone.dot ? (
              <View style={[styles.badgeDot, { backgroundColor: urgencyTone.foreground }]} />
            ) : null}
            <Text style={[styles.badgeLabel, { color: urgencyTone.foreground }]}>
              {urgency.label}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: seatTone.background }]}>
            <Text style={[styles.badgeLabel, { color: seatTone.foreground }]}>
              {formatSeats(seats.available)}
            </Text>
          </View>
        </View>
      </View>

      {trip.my_booking ? (
        <View style={styles.bookingFlag}>
          <Text style={styles.bookingFlagLabel}>
            {trip.my_booking.status === "pending"
              ? "You have requested a seat"
              : trip.my_booking.status === "accepted"
                ? "Your seat is confirmed"
                : `Request ${trip.my_booking.status.replace(/_/g, " ")}`}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.surface,
  },
  cardPressed: { backgroundColor: colors.cream },

  driverRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  driverDetails: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15,
    color: colors.ink,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  meta: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: inkTints.meta,
  },
  contribution: { alignItems: "flex-end" },
  contributionAmount: {
    fontFamily: fonts.body.extraBold,
    fontSize: 17,
    color: colors.terra,
  },
  contributionUnit: {
    fontFamily: fonts.body.regular,
    fontSize: 11,
    color: inkTints.placeholder,
  },

  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  originDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.acacia,
  },
  routeText: { flex: 1 },
  route: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: colors.ink,
  },
  departs: {
    marginTop: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.label,
  },

  badges: { alignItems: "flex-end", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeLabel: { fontFamily: fonts.body.extraBold, fontSize: 11 },

  bookingFlag: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  bookingFlagLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 11.5,
    color: colors.acaciaDark,
  },
});
