import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Pencil, Search as SearchIcon } from "../../../src/icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, NetworkError } from "../../../src/api/client";
import { searchTrips, type TripSearchParams } from "../../../src/api/trips";
import { TripCard } from "../../../src/components/TripCard";
import { useAuth } from "../../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../../src/theme";
import type { Trip } from "../../../src/types";

/** The chips across the top of "Twogende Search Results.dc.html". */
const FILTERS = [
  { key: "all", label: "All rides" },
  { key: "price", label: "Lowest price" },
  { key: "time", label: "Earliest" },
  { key: "seats", label: "2+ seats" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

/** Implements "Twogende Search Results.dc.html". */
export default function SearchResults() {
  const { token } = useAuth();
  const params = useLocalSearchParams<Record<string, string>>();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [results, setResults] = useState<Trip[] | null>(null);
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (activeFilter: FilterKey) => {
      if (!token) return;
      setSearching(true);
      setError(null);

      const requested = Number(params.seats) || 1;

      const query: TripSearchParams = {
        origin_place_id: params.originPlaceId || undefined,
        origin_latitude: params.originLat ? Number(params.originLat) : undefined,
        origin_longitude: params.originLng ? Number(params.originLng) : undefined,
        destination_place_id: params.destinationPlaceId || undefined,
        destination_latitude: params.destinationLat ? Number(params.destinationLat) : undefined,
        destination_longitude: params.destinationLng ? Number(params.destinationLng) : undefined,
        date: params.date || undefined,
        after: params.after || undefined,
        sort: activeFilter === "price" ? "price" : "departure",
        // The "2+ seats" chip overrides whatever the form asked for.
        seats: activeFilter === "seats" ? Math.max(2, requested) : requested,
      };

      try {
        const result = await searchTrips(token, query);
        setResults(result.data);
      } catch (e) {
        setError(
          e instanceof ApiError || e instanceof NetworkError
            ? e.message
            : "Something went wrong.",
        );
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [token, params],
  );

  useEffect(() => {
    void run(filter);
    // Re-runs when the chip changes; params are fixed for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const routeLabel = `${params.originName || "Anywhere"} → ${params.destinationName || "Anywhere"}`;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to search"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Edit this search"
          style={styles.routePill}
        >
          <SearchIcon size={16} color={colors.terra} strokeWidth={2.2} />
          <Text style={styles.routePillText} numberOfLines={1}>
            {routeLabel}
          </Text>
          <Pencil size={15} color={colors.ink} strokeWidth={2.2} style={styles.pencil} />
        </Pressable>
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map(({ key, label }) => {
            const active = key === filter;
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={results ?? []}
        keyExtractor={(trip) => String(trip.id)}
        contentContainerStyle={styles.results}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.resultsHeader}>
            <Text style={styles.resultCount}>
              {results?.length ?? 0} {results?.length === 1 ? "ride" : "rides"} found
            </Text>
            <Text style={styles.sortedBy}>
              Sorted by {filter === "price" ? "price" : "departure"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={(trip) => router.push(`/trip/${trip.id}`)} />
        )}
        ListEmptyComponent={
          searching ? (
            <ActivityIndicator color={colors.terra} style={styles.spinner} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {error ? "Could not load rides" : "No rides match yet"}
              </Text>
              <Text style={styles.emptyBody}>
                {error ?? "Try a different date or route."}
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  routePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  routePillText: {
    flex: 1,
    fontFamily: fonts.body.extraBold,
    fontSize: 14,
    letterSpacing: -0.14,
    color: colors.ink,
  },
  pencil: { opacity: 0.55 },

  chipsWrap: { paddingTop: 14, paddingBottom: 4 },
  chips: { gap: 8, paddingHorizontal: 22 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.terra, borderColor: colors.terra },
  chipLabel: { fontFamily: fonts.body.bold, fontSize: 12.5, color: colors.ink },
  chipLabelActive: { color: colors.onTerra },

  results: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 20, flexGrow: 1 },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultCount: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: inkTints.placeholder,
  },
  sortedBy: { fontFamily: fonts.body.bold, fontSize: 12, color: colors.acaciaDark },
  separator: { height: 10 },
  spinner: { marginTop: 32 },
  empty: { marginTop: 40, alignItems: "center", gap: 6, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.body.bold, fontSize: 15, color: colors.ink },
  emptyBody: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: inkTints.label,
    textAlign: "center",
  },
});
