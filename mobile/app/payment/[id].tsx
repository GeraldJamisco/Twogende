import { router, useLocalSearchParams } from "expo-router";
import {
  Check,
  ChevronLeft,
  Info,
  Smartphone,
  TriangleAlert,
} from "../../src/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { ApiError, NetworkError } from "../../src/api/client";
import {
  payForBooking,
  paymentFor,
  paymentStatus,
  type Payment,
  type PaymentMethodId,
  type PaymentScreen,
} from "../../src/api/payments";
import { formatDayLabel, formatTime } from "../../src/lib/format";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";

/** How long the design gives a provider prompt before it looks stuck. */
const APPROVAL_SECONDS = 60;

/** How often the waiting step re-reads the record while it's open. */
const POLL_MS = 4_000;

type SheetStep = "confirm" | "waiting" | "done";

/**
 * Implements "Twogende Payment.dc.html".
 *
 * `id` is the booking. Cash settles the moment the passenger says they handed
 * the money over; mobile money opens the sheet, which is a state machine over
 * a record the provider - not this screen - is allowed to complete.
 */
export default function PaymentScreenView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [screen, setScreen] = useState<PaymentScreen | null>(null);
  const [selected, setSelected] = useState<PaymentMethodId | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<SheetStep | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [phone, setPhone] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(APPROVAL_SECONDS);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const result = await paymentFor(token, Number(id));
      setScreen(result.data);
      setPhone(result.data.default_phone);

      /*
       * Already paid this ride is done with. "Payment sent" is worth seeing
       * once, at the moment it happens; landing on it every time somebody
       * reopens an old ride would just be a receipt in the way.
       */
      if (result.data.settled) {
        router.replace({ pathname: "/complete/[id]", params: { id } });
      }
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not load this payment.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  // The countdown only runs while a request is actually outstanding.
  useEffect(() => {
    if (step !== "waiting") return;

    const timer = setInterval(
      () => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)),
      1_000,
    );

    return () => clearInterval(timer);
  }, [step]);

  /*
   * A provider's answer arrives out of band, so the only way this screen finds
   * out is by asking. Tapping "I approved it" cannot settle anything - if a
   * button in the app completed a payment, every ride would be free.
   */
  useEffect(() => {
    if (step !== "waiting" || !payment || !token) return;

    const check = async () => {
      try {
        const result = await paymentStatus(token, payment.id);
        setPayment(result.data);

        if (result.settled) setStep("done");
        if (result.data.status === "failed") {
          setSheetError(result.data.failure_reason ?? "The payment failed.");
          setStep("confirm");
        }
      } catch {
        // A dropped poll is not worth showing. The next one will tell us.
      }
    };

    const timer = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(timer);
  }, [step, payment, token]);

  const method = screen?.methods.find((m) => m.method === selected) ?? null;
  const isCash = selected === "cash";

  async function primary() {
    if (!selected) return;

    if (!isCash) {
      // Mobile money asks before it charges. The sheet is where the request
      // is actually sent.
      setSheetError(null);
      setStep("confirm");
      return;
    }

    await send();
  }

  async function send() {
    if (!token || !selected) return;

    setBusy(true);
    setError(null);
    setSheetError(null);

    try {
      const result = await payForBooking(token, Number(id), {
        method: selected,
        phone: isCash ? undefined : phone,
      });

      setPayment(result.data);

      if (result.settled) {
        setStep("done");
      } else {
        setSecondsLeft(APPROVAL_SECONDS);
        setStep("waiting");
      }
    } catch (e) {
      const message =
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not record this payment.";

      // A cash failure belongs on the screen; a provider failure belongs in
      // the sheet, where the button that caused it lives.
      if (isCash) setError(message);
      else setSheetError(message);
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    router.replace({ pathname: "/complete/[id]", params: { id } });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator style={styles.loader} color={colors.terra} />
      </SafeAreaView>
    );
  }

  const driver = screen?.driver;
  const driverName = driver?.name ?? "the driver";
  const driverFirstName = driver?.first_name ?? driverName;
  const provider = method?.provider ?? "Mobile Money";
  const amount = screen ? money(screen.amount, screen.currency) : "";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={19} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>Complete payment</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {screen ? (
          <View style={styles.tripCard}>
            <Text style={styles.tripRoute}>
              {screen.route.origin} → {screen.route.destination}
            </Text>
            <Text style={styles.tripMeta}>
              {driverName}
              {screen.departure_at
                ? ` · ${formatDayLabel(screen.departure_at)}, ${formatTime(screen.departure_at)}`
                : ""}
            </Text>
          </View>
        ) : null}

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount to pay</Text>
          <Text style={styles.amount}>{amount}</Text>
          <Text style={styles.amountNote}>As agreed with {driverFirstName}</Text>
        </View>

        <Text style={styles.question}>How do you want to pay?</Text>

        <View style={styles.methods}>
          {screen?.methods.map((option) => {
            const chosen = selected === option.method;

            return (
              <Pressable
                key={option.method}
                onPress={() => setSelected(option.method)}
                style={[styles.method, chosen && styles.methodChosen]}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
              >
                <View style={[styles.radio, chosen && styles.radioChosen]}>
                  {chosen ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.methodText}>
                  <Text style={styles.methodLabel}>{option.label}</Text>
                  <Text style={styles.methodNote}>{option.note}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {isCash ? (
          <View style={styles.cashNote}>
            <Info
              size={16}
              color={colors.acaciaDark}
              strokeWidth={2.2}
              style={styles.noteIcon}
            />
            <Text style={styles.cashNoteText}>
              Hand the agreed amount to {driverFirstName} at the destination,
              then mark it completed.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <Pressable
            onPress={() => void primary()}
            disabled={!selected || busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primary,
              (!selected || busy) && styles.primaryDisabled,
              pressed && selected && !busy && styles.pressed,
            ]}
          >
            <Text style={styles.primaryLabel}>
              {busy
                ? "Saving…"
                : isCash
                  ? "Payment completed"
                  : "Continue to pay"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={styles.backLink}
          >
            <Text style={styles.backLinkLabel}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={step !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setStep(null)}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.sheet}>
              <View style={styles.grabber} />

              {step === "confirm" ? (
                <ConfirmStep
                  provider={provider}
                  phone={phone}
                  editing={editingPhone}
                  onEdit={() => setEditingPhone(true)}
                  onPhoneChange={setPhone}
                  driverName={driverName}
                  amount={amount}
                  busy={busy}
                  error={sheetError}
                  onSend={() => void send()}
                  onCancel={() => setStep(null)}
                />
              ) : null}

              {step === "waiting" ? (
                <WaitingStep
                  provider={provider}
                  phone={payment?.payer_phone ?? phone}
                  amount={amount}
                  secondsLeft={secondsLeft}
                  onResend={() => {
                    setSecondsLeft(APPROVAL_SECONDS);
                    void send();
                  }}
                  onCancel={() => setStep(null)}
                />
              ) : null}

              {step === "done" && payment ? (
                <DoneStep
                  amount={money(payment.amount, payment.currency)}
                  driverName={driverName}
                  methodLabel={payment.method_label}
                  reference={payment.reference}
                  onDone={finish}
                />
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- sheet steps ---------- */

function ConfirmStep({
  provider,
  phone,
  editing,
  onEdit,
  onPhoneChange,
  driverName,
  amount,
  busy,
  error,
  onSend,
  onCancel,
}: {
  provider: string;
  phone: string;
  editing: boolean;
  onEdit: () => void;
  onPhoneChange: (value: string) => void;
  driverName: string;
  amount: string;
  busy: boolean;
  error: string | null;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.step}>
      <View>
        <Text style={styles.sheetTitle}>Pay with {provider}</Text>
        <Text style={styles.sheetSub}>
          A payment request will be sent to your phone.
        </Text>
      </View>

      <View style={styles.phoneCard}>
        <View style={styles.phoneIcon}>
          <Smartphone size={19} color={colors.onTerra} strokeWidth={2.2} />
        </View>
        <View style={styles.phoneText}>
          <Text style={styles.phoneLabel}>Registered {provider} number</Text>
          {editing ? (
            <TextInput
              value={phone}
              onChangeText={onPhoneChange}
              keyboardType="phone-pad"
              autoFocus
              style={styles.phoneInput}
            />
          ) : (
            <Text style={styles.phoneNumber}>{phone}</Text>
          )}
        </View>
      </View>

      {!editing ? (
        <Pressable onPress={onEdit} accessibilityRole="button">
          <Text style={styles.link}>Use a different number</Text>
        </Pressable>
      ) : null}

      <View style={styles.payingStrip}>
        <Text style={styles.payingLabel}>Paying {driverName}</Text>
        <Text style={styles.payingAmount}>{amount}</Text>
      </View>

      {error ? <Text style={styles.sheetError}>{error}</Text> : null}

      <Pressable
        onPress={onSend}
        disabled={busy}
        accessibilityRole="button"
        style={[styles.sheetPrimary, busy && styles.primaryDisabled]}
      >
        <Text style={styles.sheetPrimaryLabel}>
          {busy ? "Sending…" : "Send payment request"}
        </Text>
      </Pressable>

      <Pressable onPress={onCancel} accessibilityRole="button">
        <Text style={styles.sheetCancel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function WaitingStep({
  provider,
  phone,
  amount,
  secondsLeft,
  onResend,
  onCancel,
}: {
  provider: string;
  phone: string;
  amount: string;
  secondsLeft: number;
  onResend: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={[styles.step, styles.stepCentred]}>
      <Spinner />

      <View>
        <Text style={[styles.sheetTitle, styles.centred]}>Check your phone</Text>
        <Text style={[styles.sheetBody, styles.centred]}>
          We sent a {provider} request to <Text style={styles.strong}>{phone}</Text>. Enter
          your PIN on the prompt that appears on your phone to approve{" "}
          <Text style={styles.strong}>{amount}</Text>.
        </Text>
      </View>

      <View style={styles.pinWarning}>
        <TriangleAlert
          size={15}
          color={colors.ochre}
          strokeWidth={2.2}
          style={styles.noteIcon}
        />
        <Text style={styles.pinWarningText}>
          Never type your PIN inside Twogende - it is only ever entered on your
          phone&apos;s own {provider} prompt.
        </Text>
      </View>

      <Text style={styles.countdown}>
        Waiting for approval · 0:{String(secondsLeft % 60).padStart(2, "0")}
      </Text>

      {/*
        "I approved it" is not on this screen. The design offered it, but a
        passenger tapping a button is not the provider saying money moved - and treating it as one would make every ride free. The screen finds
        out by asking, which it is already doing every few seconds.
      */}
      <View style={styles.waitingActions}>
        <Pressable
          onPress={onResend}
          accessibilityRole="button"
          style={styles.sheetSecondary}
        >
          <Text style={styles.sheetSecondaryLabel}>Resend request</Text>
        </Pressable>

        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={styles.sheetCancel}>Cancel payment</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DoneStep({
  amount,
  driverName,
  methodLabel,
  reference,
  onDone,
}: {
  amount: string;
  driverName: string;
  methodLabel: string;
  reference: string;
  onDone: () => void;
}) {
  return (
    <View style={[styles.step, styles.stepCentred]}>
      <View style={styles.doneCheck}>
        <Check size={28} color={colors.onAcacia} strokeWidth={2.6} />
      </View>

      <View>
        <Text style={[styles.sheetTitle, styles.centred]}>Payment sent</Text>
        <Text style={[styles.sheetBody, styles.centred]}>
          <Text style={styles.strong}>{amount}</Text> paid to {driverName} via{" "}
          {methodLabel}.
        </Text>
      </View>

      <View style={styles.referenceRow}>
        <Text style={styles.referenceLabel}>Reference</Text>
        <Text style={styles.referenceValue}>{reference}</Text>
      </View>

      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        style={styles.sheetPrimary}
      >
        <Text style={styles.sheetPrimaryLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

/** The design's 52px ring, rotating. */
function Spinner() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1_100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={52} height={52} viewBox="0 0 56 56" fill="none">
        <Circle
          cx={28}
          cy={28}
          r={25}
          stroke={colors.divider}
          strokeWidth={4}
        />
        <Path
          d="M28 3a25 25 0 0 1 25 25"
          stroke={colors.terra}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * Exact figures, not the "15k" shorthand used on trip cards. This is money
 * changing hands and rounding it would be wrong.
 */
function money(amount: number, currency: string): string {
  const symbol = currency === "UGX" ? "USh" : currency;

  return `${symbol} ${amount.toLocaleString("en-UG")}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  loader: { marginTop: 80 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: colors.ink,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 26,
    flexGrow: 1,
  },

  tripCard: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  tripRoute: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14.5,
    color: colors.ink,
  },
  tripMeta: {
    marginTop: 2,
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.label,
  },

  amountCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 14,
    alignItems: "center",
  },
  amountLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: inkTints.label,
    marginBottom: 8,
  },
  amount: {
    fontFamily: fonts.display.bold,
    fontSize: 32,
    color: colors.terra,
  },
  amountNote: {
    marginTop: 8,
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.timestamp,
  },

  question: {
    fontFamily: fonts.display.bold,
    fontSize: 14,
    color: colors.ink,
    marginTop: 20,
    marginBottom: 4,
  },

  methods: { gap: 9, marginTop: 12 },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  methodChosen: {
    borderColor: colors.terra,
    backgroundColor: "rgba(192,81,46,0.06)",
  },
  methodText: { flex: 1 },
  methodLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: colors.ink,
  },
  methodNote: {
    marginTop: 1,
    fontFamily: fonts.body.regular,
    fontSize: 11,
    color: inkTints.timestamp,
  },

  radio: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 2,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  radioChosen: { borderColor: colors.terra, backgroundColor: colors.terra },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.onTerra,
  },

  noteIcon: { marginTop: 1 },
  cashNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: "rgba(108,122,69,0.10)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  cashNoteText: {
    flex: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    lineHeight: 18.75,
    color: colors.acaciaDark,
  },

  error: {
    marginTop: 14,
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.terraDark,
    textAlign: "center",
  },

  spacer: { flex: 1, minHeight: 22 },
  actions: { marginTop: 22, gap: 10 },
  primary: {
    backgroundColor: colors.terra,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  primaryDisabled: { opacity: 0.45 },
  pressed: { transform: [{ translateY: 1 }] },
  primaryLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15.5,
    color: colors.onTerra,
  },
  backLink: { padding: 6, alignItems: "center" },
  backLinkLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: inkTints.label,
  },

  /* ---------- sheet ---------- */

  overlay: {
    flex: 1,
    backgroundColor: "rgba(36,29,22,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 22,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    alignSelf: "center",
  },

  step: { gap: 15 },
  stepCentred: { alignItems: "center" },
  centred: { textAlign: "center" },

  sheetTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 19,
    color: colors.ink,
    marginBottom: 5,
  },
  sheetSub: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    color: inkTints.label,
  },
  sheetBody: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    lineHeight: 20.15,
    color: inkTints.meta,
  },
  strong: { fontFamily: fonts.body.extraBold, color: colors.ink },

  phoneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  phoneIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.ochre,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneText: { flex: 1, minWidth: 0 },
  phoneLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 11.5,
    color: inkTints.placeholder,
  },
  phoneNumber: {
    marginTop: 1,
    fontFamily: fonts.body.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
  phoneInput: {
    marginTop: 1,
    fontFamily: fonts.body.extraBold,
    fontSize: 15,
    color: colors.ink,
    padding: 0,
  },
  link: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: colors.terra,
  },

  payingStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(192,81,46,0.06)",
    borderRadius: 14,
  },
  payingLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: inkTints.meta,
  },
  payingAmount: {
    fontFamily: fonts.body.extraBold,
    fontSize: 18,
    color: colors.terra,
  },

  sheetError: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    lineHeight: 18.75,
    color: colors.terraDark,
  },

  sheetPrimary: {
    backgroundColor: colors.terra,
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    alignSelf: "stretch",
  },
  sheetPrimaryLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14.5,
    color: colors.onTerra,
  },
  sheetSecondary: {
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 15,
    padding: 13,
    alignItems: "center",
  },
  sheetSecondaryLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: colors.ink,
  },
  sheetCancel: {
    fontFamily: fonts.body.bold,
    fontSize: 13,
    color: inkTints.placeholder,
    textAlign: "center",
    padding: 2,
  },

  pinWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: "rgba(207,154,69,0.16)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pinWarningText: {
    flex: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(43,32,24,0.75)",
  },
  countdown: {
    fontFamily: fonts.body.bold,
    fontSize: 12,
    color: inkTints.timestamp,
  },
  waitingActions: { gap: 9, alignSelf: "stretch" },

  doneCheck: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.acacia,
    alignItems: "center",
    justifyContent: "center",
  },
  referenceRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  referenceLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: inkTints.placeholder,
  },
  referenceValue: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: colors.ink,
  },
});
