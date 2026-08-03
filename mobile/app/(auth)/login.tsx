import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { lookupAccount, requestOtp } from "../../src/api/auth";
import { ApiError, NetworkError } from "../../src/api/client";
import { Button } from "../../src/components/ui/Button";
import {
  PhoneInput,
  phoneDigitCount,
  toE164,
} from "../../src/components/ui/PhoneInput";
import { colors, fonts, inkTints } from "../../src/theme";

/**
 * Sign in. The number is looked up first so a returning user can be greeted by
 * name, and so an unrecognised number gets a chance to be corrected before
 * anyone pays to send an SMS to it.
 */
export default function Login() {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | NetworkError | null>(null);

  /** Set once the number has been checked; drives the confirmation step. */
  const [checked, setChecked] = useState<{
    phone: string;
    display: string;
    exists: boolean;
    greetingName: string | null;
  } | null>(null);

  const ready = phoneDigitCount(phone) >= 9;

  async function check() {
    setBusy(true);
    setError(null);

    try {
      const result = await lookupAccount(toE164(phone));
      setChecked({
        phone: result.phone,
        display: result.phone_display,
        exists: result.exists,
        greetingName: result.greeting_name,
      });
    } catch (e) {
      setError(e as ApiError | NetworkError);
    } finally {
      setBusy(false);
    }
  }

  /** Sends the code, for a recognised number or a confirmed new one. */
  async function sendCode() {
    if (!checked) return;
    setBusy(true);
    setError(null);

    try {
      const result = await requestOtp(checked.phone);
      router.push({
        pathname: "/(auth)/verify",
        params: {
          phone: result.phone,
          channel: result.channel,
          greetingName: checked.greetingName ?? "",
          isNew: checked.exists ? "" : "1",
        },
      });
    } catch (e) {
      setError(e as ApiError | NetworkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>
            {checked?.exists
              ? `Welcome back${checked.greetingName ? `, ${checked.greetingName}` : ""}`
              : "Welcome back"}
          </Text>

          <Text style={styles.subheading}>
            {checked === null
              ? "Enter your number and we'll send you a code."
              : checked.exists
                ? `We'll send a code to ${checked.display} via WhatsApp or SMS.`
                : `We couldn't find a Twogende account for ${checked.display}.`}
          </Text>

          {error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error.message}</Text>
            </View>
          ) : null}

          <PhoneInput
            value={phone}
            onChangeText={(next) => {
              setPhone(next);
              // Any edit invalidates the previous check.
              setChecked(null);
            }}
            hint="Ugandan mobile number"
            error={
              error instanceof ApiError ? error.fieldError("phone") : undefined
            }
          />

          {checked === null ? (
            <Button
              label="Continue"
              onPress={check}
              loading={busy}
              disabled={!ready}
            />
          ) : checked.exists ? (
            <Button label="Send me a code" onPress={sendCode} loading={busy} />
          ) : (
            <>
              {/*
                No account. Confirm the number is right before spending an SMS
                on it — a mistyped digit is the likeliest explanation.
              */}
              <View style={styles.confirm}>
                <Text style={styles.confirmTitle}>
                  Create a new account for this number?
                </Text>
                <Text style={styles.confirmBody}>
                  Check that {checked.display} is correct. We'll send a code to
                  confirm it's yours.
                </Text>
              </View>

              <Button
                label="Yes, create my account"
                onPress={sendCode}
                loading={busy}
              />
              <Button
                label="Change the number"
                variant="quiet"
                onPress={() => setChecked(null)}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  content: { padding: 26, gap: 18, paddingBottom: 40 },
  heading: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    lineHeight: 32.2,
    letterSpacing: -0.56,
    color: colors.ink,
  },
  subheading: {
    fontFamily: fonts.body.medium,
    fontSize: 15,
    lineHeight: 22.5,
    color: inkTints.tagline,
    marginTop: -12,
  },
  banner: {
    backgroundColor: "rgba(192,81,46,0.10)",
    borderRadius: 16,
    padding: 13,
  },
  bannerText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    color: colors.terraDark,
  },
  confirm: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  confirmTitle: {
    fontFamily: fonts.body.extraBold,
    fontSize: 14.5,
    color: colors.ink,
  },
  confirmBody: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    lineHeight: 19.5,
    color: inkTints.label,
  },
});
