import { router, useLocalSearchParams } from "expo-router";
import {
  Camera,
  ChevronLeft,
  ChevronUp,
  Languages,
  Link2,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { showBooking, type Booking } from "../../src/api/bookings";
import { ApiError, NetworkError } from "../../src/api/client";
import { resolveCurrentPlace } from "../../src/lib/currentLocation";
import {
  imageHeaders,
  messagesFor,
  sendImage,
  sendLocation,
  sendMessage,
  type Message,
} from "../../src/api/messages";
import { Avatar } from "../../src/components/Avatar";
import { formatTime } from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";

/** The chips under "Smart suggestions", from the design. */
const QUICK_REPLIES = ["I'm on my way", "I'm here", "5 min away"];

/** Implements "Twogende Chat.dc.html" — the passenger's side. */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);

  const threadRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const [bookingResult, messageResult] = await Promise.all([
        showBooking(token, Number(id)),
        messagesFor(token, Number(id)),
      ]);
      setBooking(bookingResult.data);
      setMessages(messageResult.data);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not load this conversation.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(body: string) {
    const text = body.trim();
    if (!token || !text) return;

    setSending(true);
    try {
      const { data } = await sendMessage(token, Number(id), text);
      setMessages((existing) => [...existing, data]);
      setDraft("");
      requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not send that message.",
      );
    } finally {
      setSending(false);
    }
  }

  /** Drop a pin where I am, so the other person can just walk to it. */
  async function shareLocation() {
    if (!token) return;
    setSending(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Location access needed",
          "Twogende needs this to share where you are. You can enable it in Settings.",
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Named if we can name it — "Ntinda stage" beats a pair of numbers.
      const place = await resolveCurrentPlace(token).catch(() => null);

      const { data } = await sendLocation(token, Number(id), {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: place?.status === "ok" ? place.place.name : undefined,
      });

      setMessages((existing) => [...existing, data]);
    } catch (e) {
      Alert.alert("Could not share your location", (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  /** A photo of where you're standing, when words aren't enough. */
  async function sendPhoto() {
    if (!token) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera access needed",
        "Twogende needs this to send a photo. You can enable it in Settings.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;

    setSending(true);
    try {
      const { data } = await sendImage(token, Number(id), result.assets[0].uri);
      setMessages((existing) => [...existing, data]);
    } catch (e) {
      Alert.alert("Could not send that photo", (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centre}>
        <ActivityIndicator color={colors.terra} />
      </SafeAreaView>
    );
  }

  // Resolved server-side, so this same screen serves the driver and the
  // passenger without either side re-deriving who they're talking to.
  const other = booking?.with;
  const vehicle = booking?.trip?.vehicle;
  const chatOpen = booking?.chat.open ?? false;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <ChevronLeft size={19} color={colors.ink} strokeWidth={2.2} />
        </Pressable>

        <Avatar name={other?.name ?? "?"} photoUrl={other?.photo_url ?? null} size={42} />

        <View style={styles.headerText}>
          <Text style={styles.contactName} numberOfLines={1}>
            {other?.first_name ?? other?.name ?? "Conversation"}
          </Text>
          <Text style={styles.vehicleLine} numberOfLines={1}>
            {vehicle?.identifier || "Vehicle details to follow"}
          </Text>
        </View>

        {/*
          In-app calling isn't built yet — the button is here as designed but
          inert, and it's on the pre-launch list. See LAUNCH-CHECKLIST.md.
        */}
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityLabel="Call"
          style={[styles.callButton, styles.disabled]}
        >
          <Phone size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
        style={styles.flex}
      >
        {/*
          Translation has no backend yet, so the control is shown as the design
          has it but left inert rather than pretending to work.
        */}
        <View style={styles.translateRow}>
          <View style={styles.translateIcon}>
            <Languages size={15} color={colors.onTerra} strokeWidth={2.3} />
          </View>
          <Text style={styles.translateLabel}>Translate this chat</Text>
          <Switch
            value={false}
            disabled
            trackColor={{ false: colors.divider, true: colors.acacia }}
            thumbColor="#fff"
          />
        </View>

        <ScrollView
          ref={threadRef}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) =>
            message.kind === "system" ? (
              // Written by Twogende, so it gets the badge rather than a
              // bubble — nobody should think their driver typed this.
              <View key={message.id} style={styles.systemRow}>
                <View style={styles.systemIcon}>
                  <Link2 size={14} color={colors.onTerra} strokeWidth={2.3} />
                </View>
                <View style={styles.systemCard}>
                  <Text style={styles.systemName}>Twogende</Text>
                  <Text style={styles.systemBody}>👋 {message.body}</Text>
                  <Text style={styles.systemTime}>
                    {message.sent_at ? formatTime(message.sent_at) : ""}
                  </Text>
                </View>
              </View>
            ) : message.kind === "image" && message.image_url ? (
              <View
                key={message.id}
                style={[styles.attachment, message.is_mine && styles.attachmentMine]}
              >
                <Image
                  source={{ uri: message.image_url, headers: imageHeaders(token ?? "") }}
                  style={styles.photo}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                  accessibilityLabel="Photo in this conversation"
                />
              </View>
            ) : message.kind === "location" && message.location ? (
              <View
                key={message.id}
                style={[styles.attachment, message.is_mine && styles.attachmentMine]}
              >
                <View style={styles.pin}>
                  <MapPin size={18} color={colors.terra} strokeWidth={2.2} />
                  <View style={styles.pinText}>
                    <Text style={styles.pinTitle}>
                      {message.is_mine ? "You shared a location" : "Shared a location"}
                    </Text>
                    <Text style={styles.pinBody} numberOfLines={1}>
                      {message.body ??
                        `${message.location.latitude.toFixed(5)}, ${message.location.longitude.toFixed(5)}`}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View
                key={message.id}
                style={[styles.bubble, message.is_mine ? styles.bubbleMine : styles.bubbleTheirs]}
              >
                <Text style={[styles.bubbleText, message.is_mine && styles.bubbleTextMine]}>
                  {message.body}
                </Text>
                <Text style={[styles.bubbleTime, message.is_mine && styles.bubbleTimeMine]}>
                  {message.sent_at ? formatTime(message.sent_at) : ""}
                </Text>
              </View>
            ),
          )}

          <View style={styles.noticeTerra}>
            <Text style={styles.noticeTitle}>Pickup point</Text>
            <Text style={styles.noticeBody}>
              Is your pickup point on the map inaccurate? Let us know{" "}
              <Text style={styles.noticeLink}>here</Text>!
            </Text>
          </View>

          {booking?.status === "completed" ? (
            <View style={styles.noticeOchre}>
              <Text style={styles.noticeTitle}>Quick check!</Text>
              <Text style={styles.noticeBody}>
                Take all your belongings. Left something? Message your driver right here
                within 4 hours. Don&apos;t worry.
              </Text>
            </View>
          ) : null}

          {booking?.chat.closes_at ? (
            <View style={styles.noticeOchre}>
              <Text style={styles.noticeBody}>
                This chat remains open for this ride until{" "}
                <Text style={styles.noticeStrong}>
                  {formatClosesAt(booking.chat.closes_at)}
                </Text>
                . Drivers may take some time to reply.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.suggestions}>
          <Pressable
            onPress={() => setSuggestionsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: suggestionsOpen }}
            style={styles.suggestionsHeader}
          >
            <Sparkles size={15} color={colors.acaciaDark} strokeWidth={2.2} />
            <Text style={styles.suggestionsLabel}>Smart suggestions</Text>
            <ChevronUp
              size={15}
              color={colors.ink}
              strokeWidth={2.2}
              style={!suggestionsOpen && styles.chevronFlipped}
            />
          </Pressable>

          {suggestionsOpen ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {QUICK_REPLIES.map((reply) => (
                <Pressable
                  key={reply}
                  onPress={() => void send(reply)}
                  disabled={!chatOpen || sending}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.chipPressed,
                    !chatOpen && styles.disabled,
                  ]}
                >
                  <Text style={styles.chipLabel}>{reply}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.composer}>
          <Pressable
            onPress={shareLocation}
            disabled={!chatOpen || sending}
            accessibilityRole="button"
            accessibilityLabel="Share your location"
            style={({ pressed }) => [
              styles.composerIcon,
              pressed && styles.pressed,
              (!chatOpen || sending) && styles.disabled,
            ]}
          >
            <MapPin size={21} color={colors.terra} strokeWidth={2.2} />
          </Pressable>

          {/*
            Single line with a "send" return key: the design has no send
            button — location, input, camera — so the keyboard is the only way
            to post a message. Multiline would swallow the return instead.
          */}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={chatOpen ? "Type your message" : "This chat has closed"}
            placeholderTextColor={inkTints.inputPlaceholder}
            editable={chatOpen && !sending}
            returnKeyType="send"
            onSubmitEditing={() => void send(draft)}
            blurOnSubmit={false}
            accessibilityLabel="Message"
            accessibilityHint="Press the send key to post your message"
            style={styles.input}
          />

          <Pressable
            onPress={sendPhoto}
            disabled={!chatOpen || sending}
            accessibilityRole="button"
            accessibilityLabel="Send a photo"
            style={({ pressed }) => [
              styles.composerIcon,
              pressed && styles.pressed,
              (!chatOpen || sending) && styles.disabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Camera size={20} color={colors.ink} strokeWidth={2.2} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** "Aug 4, 6:28 PM". */
function formatClosesAt(iso: string): string {
  const date = new Date(iso);

  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${date.toLocaleTimeString(
    [],
    { hour: "numeric", minute: "2-digit", hour12: true },
  )}`;
}

const styles = StyleSheet.create({
  // The design puts this screen on surface, not the usual cream.
  screen: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { backgroundColor: colors.divider },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  contactName: {
    fontFamily: fonts.display.bold,
    fontSize: 15.5,
    color: colors.ink,
  },
  vehicleLine: {
    fontFamily: fonts.body.semiBold,
    fontSize: 11.5,
    color: inkTints.label,
  },

  translateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.cream,
  },
  translateIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.acacia,
    alignItems: "center",
    justifyContent: "center",
  },
  translateLabel: { flex: 1, fontFamily: fonts.body.bold, fontSize: 13, color: colors.ink },

  thread: { padding: 20, gap: 12 },

  bubble: { maxWidth: "78%", paddingVertical: 11, paddingHorizontal: 14 },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.acaciaDark,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: fonts.body.medium,
    fontSize: 13.5,
    lineHeight: 18.9,
    color: colors.ink,
  },
  bubbleTextMine: { color: colors.onTerra },
  bubbleTime: {
    marginTop: 4,
    fontFamily: fonts.body.regular,
    fontSize: 10,
    color: inkTints.placeholder,
    textAlign: "right",
  },
  bubbleTimeMine: { color: colors.onTerra, opacity: 0.75 },

  systemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  systemIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.terra,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  systemCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  systemName: {
    fontFamily: fonts.body.extraBold,
    fontSize: 12.5,
    color: colors.terraDark,
    marginBottom: 3,
  },
  systemBody: {
    fontFamily: fonts.body.regular,
    fontSize: 12.5,
    lineHeight: 18.75,
    color: colors.ink,
  },
  systemTime: {
    marginTop: 6,
    fontFamily: fonts.body.regular,
    fontSize: 10,
    color: "rgba(43,32,24,0.4)",
  },

  noticeTerra: {
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: "rgba(192,81,46,0.10)",
  },
  noticeOchre: {
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: "rgba(207,154,69,0.16)",
  },
  noticeTitle: {
    fontFamily: fonts.body.extraBold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 3,
  },
  noticeBody: {
    fontFamily: fonts.body.regular,
    fontSize: 12.5,
    lineHeight: 18.75,
    color: "rgba(43,32,24,0.8)",
  },
  noticeLink: { fontFamily: fonts.body.bold, color: colors.acaciaDark },
  noticeStrong: { fontFamily: fonts.body.extraBold, color: colors.ink },

  error: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    color: colors.terraDark,
  },

  suggestions: { borderTopWidth: 1, borderTopColor: colors.divider },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  suggestionsLabel: {
    flex: 1,
    fontFamily: fonts.body.extraBold,
    fontSize: 12.5,
    color: colors.acaciaDark,
  },
  chevronFlipped: { transform: [{ rotate: "180deg" }] },
  chips: { gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  chipPressed: { backgroundColor: colors.cream },
  chipLabel: { fontFamily: fonts.body.bold, fontSize: 12.5, color: colors.ink },

  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: colors.surface,
  },
  composerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cream,
    borderRadius: 20,
    paddingVertical: 11,
    paddingHorizontal: 16,
    fontFamily: fonts.body.medium,
    fontSize: 13.5,
    color: colors.ink,
  },
  disabled: { opacity: 0.4 },
  pressed: { transform: [{ translateY: 1 }] },

  attachment: { maxWidth: "78%", alignSelf: "flex-start" },
  attachmentMine: { alignSelf: "flex-end" },
  photo: {
    width: 220,
    height: 165,
    borderRadius: 14,
    backgroundColor: colors.cream,
  },
  pin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cream,
  },
  pinText: { flex: 1 },
  pinTitle: { fontFamily: fonts.body.extraBold, fontSize: 13, color: colors.ink },
  pinBody: {
    marginTop: 1,
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: inkTints.label,
  },
});
