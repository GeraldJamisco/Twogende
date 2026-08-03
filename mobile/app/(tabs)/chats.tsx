import { router, useFocusEffect } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, NetworkError } from "../../src/api/client";
import { conversations, type Conversation } from "../../src/api/messages";
import { Avatar } from "../../src/components/Avatar";
import { formatDayLabel, formatTime } from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";

/**
 * The Chats tab.
 *
 * No mockup for this one — built from the established patterns so it doesn't
 * introduce a new visual language: the uppercase section labels come from the
 * ride-management screen, the row shape from its confirmed-passenger list, and
 * the empty state from Home and Trips.
 *
 * Split into running and ended conversations, because a chat that has closed
 * can still be read but not written to, and burying that distinction would
 * leave people typing into a thread that won't accept anything.
 */
export default function Chats() {
  const { token } = useAuth();

  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const { data } = await conversations(token);
      setItems(data);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not load your chats.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Unread counts go stale the moment a message arrives, so this refreshes
  // every time the tab is opened rather than only on mount.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const active = items.filter((c) => c.chat.open);
  const ended = items.filter((c) => !c.chat.open);

  const sections = [
    ...(active.length ? [{ title: "Ongoing", data: active }] : []),
    ...(ended.length ? [{ title: "Ended", data: ended }] : []),
  ];

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <Text style={styles.heading}>Chats</Text>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.booking_id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
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
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel}>{section.title}</Text>
        )}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.terra} style={styles.spinner} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MessageCircle size={26} color={inkTints.placeholder} strokeWidth={2} />
              </View>
              <Text style={styles.emptyTitle}>
                {error ? "Could not load your chats" : "No messages yet"}
              </Text>
              <Text style={styles.emptyBody}>
                {error ??
                  "Request a seat and you'll be able to message the driver about where to meet."}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { with: other, last_message: last, unread_count: unread } = conversation;
  const ended = !conversation.chat.open;
  const hasUnread = unread > 0;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/chat/[id]", params: { id: conversation.booking_id } })
      }
      accessibilityRole="button"
      accessibilityLabel={
        `${other?.name ?? "Conversation"}. ${conversation.route ?? ""}. ` +
        (hasUnread ? `${unread} unread. ` : "") +
        (ended ? "This chat has ended." : "")
      }
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, ended && styles.rowEnded]}
    >
      <Avatar name={other?.name ?? "?"} photoUrl={other?.photo_url ?? null} size={44} />

      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {other?.name ?? "Conversation"}
          </Text>
          <Text style={styles.time}>
            {last?.sent_at ? formatTime(last.sent_at) : ""}
          </Text>
        </View>

        <Text style={styles.route} numberOfLines={1}>
          {conversation.route ?? "Trip"}
          {conversation.departure_at ? ` · ${formatDayLabel(conversation.departure_at)}` : ""}
        </Text>

        <View style={styles.rowBottom}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {last ? `${last.is_mine ? "You: " : ""}${last.body}` : "No messages yet"}
          </Text>

          {hasUnread ? (
            <View style={styles.unread}>
              <Text style={styles.unreadLabel}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          ) : ended ? (
            <View style={styles.endedBadge}>
              <Text style={styles.endedLabel}>Ended</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  heading: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    letterSpacing: -0.56,
    color: colors.ink,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 4,
  },

  list: { paddingHorizontal: 22, paddingBottom: 20, flexGrow: 1 },
  sectionLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 1.1, // 0.1em at 11px, as every other section label
    textTransform: "uppercase",
    color: inkTints.placeholder,
    marginTop: 18,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    padding: 13,
  },
  rowPressed: { backgroundColor: colors.cream },
  // Closed conversations are readable but not writable, so they recede.
  rowEnded: { opacity: 0.62 },
  separator: { height: 10 },

  rowText: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    flex: 1,
    fontFamily: fonts.body.bold,
    fontSize: 15,
    color: colors.ink,
  },
  nameUnread: { fontFamily: fonts.body.extraBold },
  time: {
    fontFamily: fonts.body.regular,
    fontSize: 11,
    color: inkTints.placeholder,
  },
  route: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.label,
  },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 },
  preview: {
    flex: 1,
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: inkTints.placeholder,
  },
  previewUnread: { fontFamily: fonts.body.semiBold, color: colors.ink },

  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.terra,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    color: colors.onTerra,
  },
  endedBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(43,32,24,0.08)",
  },
  endedLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 10.5,
    color: inkTints.label,
  },

  spinner: { marginTop: 40 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: fonts.display.bold, fontSize: 18, color: colors.ink },
  emptyBody: {
    fontFamily: fonts.body.medium,
    fontSize: 13.5,
    lineHeight: 20,
    color: inkTints.tagline,
    textAlign: "center",
  },
});
