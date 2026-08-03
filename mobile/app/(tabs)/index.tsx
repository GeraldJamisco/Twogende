import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, NetworkError } from "../../src/api/client";
import { searchTrips } from "../../src/api/trips";
import { ActionTiles } from "../../src/components/ActionTiles";
import { HomeHeader } from "../../src/components/HomeHeader";
import { SearchPill } from "../../src/components/SearchPill";
import { TripCard } from "../../src/components/TripCard";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, gutter, inkTints } from "../../src/theme";
import type { Trip } from "../../src/types";

export default function Home() {
  const { token } = useAuth();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      // No place filters the feed is the search endpoint with nothing
      // narrowed, which is exactly "leaving soon near you".
      const result = await searchTrips(token);
      setTrips(result.data);
      setTotal(result.meta.total);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Something went wrong.",
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
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.content}>
        <HomeHeader onOpenProfile={() => router.push("/(tabs)/profile")} />
        <ActionTiles
          onOfferRide={() => router.push("/offer")}
          onFindRide={() => router.push("/(tabs)/search")}
        />
        <SearchPill onPress={() => router.push("/(tabs)/search")} />

        <FlatList
          data={trips}
          keyExtractor={(trip) => String(trip.id)}
          contentContainerStyle={styles.feedContent}
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
          ListHeaderComponent={
            <View style={styles.feedHeader}>
              <Text style={styles.feedTitle}>Leaving soon near you</Text>
              <View style={styles.liveCount}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>{total} live</Text>
              </View>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onPress={(trip) => router.push(`/trip/${trip.id}`)}
            />
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.terra} style={styles.spinner} />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  {error ? "Could not load rides" : "No rides yet"}
                </Text>
                <Text style={styles.emptyBody}>
                  {error ??
                    "Nobody has posted a trip near you. Pull down to check again."}
                </Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1 },
  feedContent: {
    paddingTop: 12,
    paddingHorizontal: gutter,
    paddingBottom: 20,
    flexGrow: 1,
  },
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  feedTitle: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 1.1, // 0.1em at 11px
    textTransform: "uppercase",
    color: colors.terra,
  },
  liveCount: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.acacia,
  },
  liveLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 11,
    color: colors.acacia,
  },
  separator: { height: 10 },
  spinner: { marginTop: 32 },
  empty: {
    marginTop: 40,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: colors.ink,
  },
  emptyBody: {
    fontFamily: fonts.body.medium,
    fontSize: 13.5,
    color: inkTints.tagline,
    textAlign: "center",
  },
});
