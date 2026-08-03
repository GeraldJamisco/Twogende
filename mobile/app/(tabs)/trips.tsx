import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '../../src/api/client';
import { myTrips } from '../../src/api/trips';
import { TripCard } from '../../src/components/TripCard';
import { useAuth } from '../../src/state/AuthContext';
import { colors, fonts, gutter, inkTints } from '../../src/theme';
import type { Trip } from '../../src/types';

/**
 * Trips this user is driving. Passenger bookings land here too once the
 * bookings endpoints exist.
 */
export default function Trips() {
  const { token, user } = useAuth();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const result = await myTrips(token);
      setTrips(result.data);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError ? e.message : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <FlatList
        data={trips}
        keyExtractor={(trip) => String(trip.id)}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
        ListHeaderComponent={<Text style={styles.heading}>Your trips</Text>}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            // Object form rather than a template string: it's the documented
            // way to push a dynamic route and doesn't rely on the generated
            // interpolated type being present.
            onPress={(trip) => router.push({ pathname: "/ride/[id]", params: { id: trip.id } })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.terra} style={styles.spinner} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {error ? 'Could not load your trips' : 'Nothing here yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {error ??
                  (user?.verification.can_drive
                    ? 'Trips you publish will show up here.'
                    : 'Verify your identity and add a vehicle to start offering rides.')}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: gutter, paddingBottom: 32, flexGrow: 1 },
  heading: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    letterSpacing: -0.84,
    color: colors.ink,
    marginBottom: 16,
  },
  separator: { height: 10 },
  spinner: { marginTop: 32 },
  empty: { marginTop: 40, alignItems: 'center', gap: 6, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.display.bold, fontSize: 18, color: colors.ink },
  emptyBody: {
    fontFamily: fonts.body.medium,
    fontSize: 13.5,
    color: inkTints.tagline,
    textAlign: 'center',
  },
});
