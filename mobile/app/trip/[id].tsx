import { ArrowLeft, ShieldCheck, Star } from "../../src/icons";
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '../../src/api/client';
import { requestSeat } from '../../src/api/bookings';
import { showTrip } from '../../src/api/trips';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/ui/Button';
import {
  formatContribution,
  formatDayLabel,
  formatRating,
  formatSeats,
  formatTime,
  formatTripCount,
} from '../../src/lib/format';
import { useAuth } from '../../src/state/AuthContext';
import { colors, fonts, gutter, inkTints } from '../../src/theme';
import type { Trip } from '../../src/types';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  /**
   * Ask the driver for a seat. The trip's origin is left as the pickup point:
   * choosing somewhere else along the route has no design yet.
   */
  async function requestSeatOnTrip() {
    if (!token || !trip) return;

    setRequesting(true);
    try {
      const { data } = await requestSeat(token, trip.id, { seats: 1 });
      router.replace({ pathname: '/booking/[id]', params: { id: data.id } });
    } catch (e) {
      Alert.alert(
        'Could not request a seat',
        e instanceof ApiError || e instanceof NetworkError ? e.message : 'Please try again.',
      );
    } finally {
      setRequesting(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const result = await showTrip(token, Number(id));
        setTrip(result.data);
      } catch (e) {
        setError(
          e instanceof ApiError || e instanceof NetworkError ? e.message : 'Something went wrong.',
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

  if (!trip) {
    return (
      <SafeAreaView style={styles.centre}>
        <ActivityIndicator color={colors.terra} />
      </SafeAreaView>
    );
  }

  const driver = trip.driver;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>

        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.rail}>
              <View style={styles.railStart} />
              <View style={styles.railLine} />
              <View style={styles.railEnd} />
            </View>
            <View style={styles.waypoints}>
              <Text style={styles.place}>{trip.origin.name}</Text>
              <Text style={styles.when}>
                {formatDayLabel(trip.departure_at)} · {formatTime(trip.departure_at)}
              </Text>
              <Text style={[styles.place, styles.destination]}>{trip.destination.name}</Text>
            </View>
          </View>

          <View style={styles.figures}>
            <View>
              <Text style={styles.amount}>
                {formatContribution(trip.contribution.per_seat, trip.contribution.currency)}
              </Text>
              <Text style={styles.amountUnit}>contribution per seat</Text>
            </View>
            <Text style={styles.seats}>{formatSeats(trip.seats.available)} left</Text>
          </View>
        </View>

        {driver ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Driver</Text>
            <View style={styles.driverRow}>
              <Avatar name={driver.name} photoUrl={driver.photo_url} size={52} />
              <View style={styles.driverText}>
                <View style={styles.nameRow}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  {driver.verification.identity ? (
                    <ShieldCheck size={14} color={colors.acacia} strokeWidth={2.4} />
                  ) : null}
                </View>
                <View style={styles.nameRow}>
                  <Star size={13} color={colors.ochre} fill={colors.ochre} strokeWidth={0} />
                  <Text style={styles.driverMeta}>
                    {formatRating(driver.reputation.rating_as_driver)} ·{' '}
                    {formatTripCount(driver.reputation.trips_as_driver)}
                  </Text>
                </View>
              </View>
            </View>
            {trip.vehicle ? <Text style={styles.vehicle}>{trip.vehicle.description}</Text> : null}
          </View>
        ) : null}

        {trip.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes from the driver</Text>
            <Text style={styles.notes}>{trip.notes}</Text>
          </View>
        ) : null}

        {trip.my_booking ? (
          <Button
            label={
              trip.my_booking.status === 'pending'
                ? 'View your request'
                : `Request ${trip.my_booking.status.replace(/_/g, ' ')}`
            }
            variant="quiet"
            onPress={() =>
              router.push({
                pathname: '/booking/[id]',
                params: { id: trip.my_booking!.id },
              })
            }
          />
        ) : (
          <Button
            label="Request a seat"
            onPress={requestSeatOnTrip}
            loading={requesting}
            disabled={trip.seats.available < 1}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    padding: gutter,
  },
  content: { padding: gutter, gap: 14, paddingBottom: 40 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  routeRow: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', gap: 2, paddingTop: 6 },
  railStart: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: colors.acacia },
  railLine: { width: 2, height: 38, backgroundColor: colors.divider },
  railEnd: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.terra },
  waypoints: { flex: 1 },
  place: { fontFamily: fonts.display.bold, fontSize: 19, color: colors.ink },
  when: { fontFamily: fonts.body.medium, fontSize: 13, color: inkTints.timestamp, marginBottom: 8 },
  destination: { marginTop: 4 },
  figures: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  amount: { fontFamily: fonts.body.extraBold, fontSize: 22, color: colors.terra },
  amountUnit: { fontFamily: fonts.body.regular, fontSize: 11.5, color: inkTints.placeholder },
  seats: { fontFamily: fonts.body.bold, fontSize: 13, color: colors.acaciaDark },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.terra,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverName: { fontFamily: fonts.body.extraBold, fontSize: 16, color: colors.ink },
  driverMeta: { fontFamily: fonts.body.regular, fontSize: 12.5, color: inkTints.meta },
  vehicle: { fontFamily: fonts.body.semiBold, fontSize: 13.5, color: inkTints.meta },
  notes: { fontFamily: fonts.body.regular, fontSize: 14, color: colors.ink, lineHeight: 21 },
  emptyBody: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: inkTints.tagline,
    textAlign: 'center',
  },
});
