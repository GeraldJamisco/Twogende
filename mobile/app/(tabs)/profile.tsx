import { router } from "expo-router";
import {
  ChevronRight,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
} from "../../src/icons";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  formatInternational,
  formatRating,
  formatTripCount,
} from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";

/** Implements "Twogende Profile.dc.html". */
export default function Profile() {
  const { user, signOut, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  // Identity review happens off-app, so the status can change while the user
  // is sitting on this screen.
  useEffect(() => {
    void refreshUser().catch(() => {});
  }, [refreshUser]);

  if (!user) return null;

  const identityVerified = user.verification.identity;
  const identityLabel = identityVerified ? "Verified" : "Not yet";
  const identityColor = identityVerified ? colors.acaciaDark : inkTints.notYet;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void reload();
              }}
              tintColor={colors.terra}
            />
          }
        >
          <View style={styles.identity}>
            {user.photo_url ? (
              <Image
                source={{ uri: user.photo_url }}
                style={styles.avatar}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(user.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}

            <Text style={styles.name}>{user.name ?? "Add your name"}</Text>
            <Text style={styles.phone}>{formatInternational(user.phone)}</Text>
          </View>

          {/* Only while there's something to do about it. */}
          {!identityVerified ? (
            <View style={styles.banner}>
              <View style={styles.bannerRow}>
                <View style={styles.bannerIcon}>
                  <ShieldAlert size={19} color="#fff" strokeWidth={2.2} />
                </View>
                <View style={styles.bannerText}>
                  <Text style={styles.bannerTitle}>
                    Verify your ID to offer rides
                  </Text>
                  <Text style={styles.bannerBody}>
                    Passengers only ride with verified drivers. It takes about 3
                    minutes.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => router.push("/verification")}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.bannerCta,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.bannerCtaLabel}>Verify now</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reputation</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>As a driver</Text>
              <View style={styles.rowValue}>
                <Star
                  size={14}
                  color={colors.ochre}
                  fill={colors.ochre}
                  strokeWidth={1}
                />
                <Text style={styles.rowValueText}>
                  {reputationLabel(
                    user.reputation.rating_as_driver,
                    user.reputation.trips_as_driver,
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.rule} />

            <View style={styles.row}>
              <Text style={styles.rowLabel}>As a passenger</Text>
              <View style={styles.rowValue}>
                <Star
                  size={14}
                  color={colors.ochre}
                  fill={colors.ochre}
                  strokeWidth={1}
                />
                <Text style={styles.rowValueText}>
                  {reputationLabel(
                    user.reputation.rating_as_passenger,
                    user.reputation.trips_as_passenger,
                  )}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Verification</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Phone number</Text>
              <View style={styles.rowValue}>
                <ShieldCheck
                  size={15}
                  color={colors.acacia}
                  strokeWidth={2.2}
                />
                <Text style={[styles.rowValueText, styles.verified]}>
                  Verified
                </Text>
              </View>
            </View>

            <View style={styles.rule} />

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Identity</Text>
              <Text style={[styles.rowValueText, { color: identityColor }]}>
                {identityLabel}
              </Text>
            </View>

            <View style={styles.rule} />

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Can publish trips</Text>
              <Text
                style={[
                  styles.rowValueText,
                  {
                    color: user.verification.can_drive
                      ? colors.acaciaDark
                      : inkTints.notYet,
                  },
                ]}
              >
                {user.verification.can_drive ? "Verified" : "Not yet"}
              </Text>
            </View>
          </View>

          {/* Above Sign out, as the design places it. */}
          <Pressable
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
          >
            <Settings size={19} color={colors.ink} strokeWidth={2} />
            <Text style={styles.settingsLabel}>Settings</Text>
            <ChevronRight size={16} color="rgba(43,32,24,0.35)" strokeWidth={2.4} />
          </Pressable>

          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/(auth)/welcome");
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          >
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** "New · No trips yet" until there's something to show. */
function reputationLabel(rating: number | null, trips: number): string {
  return `${formatRating(rating)} · ${formatTripCount(trips)}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20 },

  identity: { alignItems: "center", paddingTop: 8, paddingBottom: 26 },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 14 },
  avatarFallback: {
    // The design fills this with a 160deg ochre→terra gradient. React Native
    // has no gradient without another native module, so this is the midpoint
    // of that ramp - see the handover note.
    backgroundColor: "#c8763a",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: fonts.display.bold,
    fontSize: 34,
    color: "#fff",
    includeFontPadding: false,
  },
  name: {
    fontFamily: fonts.display.bold,
    fontSize: 22,
    letterSpacing: -0.22,
    color: colors.ink,
  },
  phone: {
    marginTop: 4,
    fontFamily: fonts.body.semiBold,
    fontSize: 14,
    color: inkTints.label,
  },

  banner: {
    backgroundColor: "rgba(192,81,46,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(192,81,46,0.30)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  bannerRow: { flexDirection: "row", gap: 12 },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.terra,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { flex: 1 },
  bannerTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 16,
    letterSpacing: -0.16,
    color: colors.ink,
    marginBottom: 4,
  },
  bannerBody: {
    fontFamily: fonts.body.regular,
    fontSize: 13.5,
    lineHeight: 20.25,
    color: "rgba(43,32,24,0.65)",
  },
  bannerCta: {
    marginTop: 14,
    backgroundColor: colors.terraDark,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
  },
  bannerCtaLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14.5,
    color: "#fff",
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 0.88, // 0.08em at 11px
    textTransform: "uppercase",
    color: colors.terra,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: { fontFamily: fonts.body.bold, fontSize: 14.5, color: colors.ink },
  rowValue: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValueText: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: inkTints.meta,
  },
  verified: { color: colors.acaciaDark },
  rule: { height: 1, backgroundColor: colors.divider, marginVertical: 14 },

  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  settingsLabel: {
    flex: 1,
    fontFamily: fonts.body.extraBold,
    fontSize: 15.5,
    color: colors.ink,
  },
  signOut: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  signOutLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15.5,
    color: colors.ink,
  },
  pressed: { transform: [{ translateY: 1 }] },
});
