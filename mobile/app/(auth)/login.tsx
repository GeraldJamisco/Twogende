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
 * Sign in.
 *
 * The number is looked up first, but what happens next depends on the answer.
 *
 * A number we recognise goes straight through to the code screen - one tap,
 * one spinner. Stopping to tell somebody their own phone number and asking
 * them to press a second button is a step that answers no question they had.
 *
 * A number we *don't* recognise stops, because there the confirmation earns
 * its place: a mistyped digit is the likeliest explanation, and the cost of
 * being wrong is an SMS sent to a stranger.
 */
export default function Login() {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | NetworkError | null>(null);

  /**
   * Set only when the lookup found no account. A recognised number never
   * lands here - it has already navigated away.
   */
  const [unknown, setUnknown] = useState<{
    phone: string;
    display: string;
  } | null>(null);

  const ready = phoneDigitCount(phone) >= 9;

  async function check() {
    setBusy(true);
    setError(null);

    try {
      const result = await lookupAccount(toE164(phone));

      if (!result.exists) {
        setUnknown({ phone: result.phone, display: result.phone_display });
        return;
      }

      /*
       * Recognised. Send the code and go, without rendering anything in
       * between - `busy` stays true across both requests so this reads as one
       * wait rather than two, and the confirmation step never flashes up.
       */
      await sendCode(result.phone, result.greeting_name, true);
    } catch (e) {
      setError(e as ApiError | NetworkError);
    } finally {
      setBusy(false);
    }
  }

  /** Sends the code and moves to the code screen. */
  async function sendCode(
    to: string,
    greetingName: string | null,
    returning: boolean,
  ) {
    const result = await requestOtp(to);

    router.push({
      pathname: "/(auth)/verify",
      params: {
        phone: result.phone,
        channel: result.channel,
        greetingName: greetingName ?? "",

        /*
         * Whether we recognised this number, sent separately from the name.
         * Plenty of real accounts have never been named - the code screen
         * still owes those people a "Welcome back", and an empty
         * greetingName on its own can't tell them apart from a stranger.
         */
        returning: returning ? "1" : "",
      },
    });
  }

  /**
   * The unknown-number path: they have confirmed the digits are right, so
   * hand them to sign-up.
   *
   * It deliberately does *not* send a code from here. Verifying a code is
   * what creates the account, so sending one now would create a nameless
   * user and drop them on the home screen with no way back to a name field.
   * Sign-up asks for a name first and sends the code itself.
   *
   * The digits travel as typed - PhoneInput's value is national digits with
   * no country code, so the field arrives filled in and correct.
   */
  function createAccount() {
    if (!unknown) return;

    router.push({
      pathname: "/(auth)/register",
      params: { phone: phone.replace(/\D/g, "") },
    });
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
          {/*
            The greeting by name now happens on the code screen, which is where
            a recognised number goes straight to. Nothing recognised is ever
            rendered here any more.
          */}
          <Text style={styles.heading}>Welcome back</Text>

          <Text style={styles.subheading}>
            {unknown === null
              ? "Enter your number and we'll send you a code."
              : `We couldn't find a Twogende account for ${unknown.display}.`}
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
              setUnknown(null);
            }}
            hint="Ugandan mobile number"
            error={
              error instanceof ApiError ? error.fieldError("phone") : undefined
            }
          />

          {unknown === null ? (
            <Button
              label="Continue"
              onPress={check}
              loading={busy}
              disabled={!ready}
            />
          ) : (
            <>
              {/*
                No account. Confirm the number is right before spending an SMS
                on it - a mistyped digit is the likeliest explanation.
              */}
              <View style={styles.confirm}>
                <Text style={styles.confirmTitle}>
                  Create a new account for this number?
                </Text>
                <Text style={styles.confirmBody}>
                  Check that {unknown.display} is correct. We'll send a code to
                  confirm it's yours.
                </Text>
              </View>

              <Button
                label="Yes, create my account"
                onPress={createAccount}
                loading={busy}
              />
              <Button
                label="Change the number"
                variant="quiet"
                onPress={() => setUnknown(null)}
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
