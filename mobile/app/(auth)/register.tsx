import { ShieldCheck } from "../../src/icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { requestOtp } from "../../src/api/auth";
import { ApiError, NetworkError } from "../../src/api/client";
import { Button } from "../../src/components/ui/Button";
import {
  PhoneInput,
  phoneDigitCount,
  toE164,
} from "../../src/components/ui/PhoneInput";
import { TextField } from "../../src/components/ui/TextField";
import { colors, fonts, inkTints } from "../../src/theme";

/**
 * Implements "Twogende Register.dc.html" from the Claude Design project.
 *
 * The mockup's status bar row (9:41, signal, battery) is canvas furniture
 * on device that's the real OS status bar, so it becomes a safe-area inset.
 */
export default function Register() {
  /*
   * Arrives filled in when sign-in sent somebody here after not recognising
   * their number - they have already typed it once and confirmed it, so
   * asking again would be asking twice. Empty when they came here directly.
   */
  const { phone: prefill } = useLocalSearchParams<{ phone?: string }>();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState(prefill ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | NetworkError | null>(null);

  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;

  // The design's enabling rule, minus the password clause it no longer has:
  // name >= 2 chars and at least 9 phone digits.
  const phoneDigits = phone.replace(/\D/g, "");
  const ctaDisabled = name.trim().length < 2 || phoneDigits.length < 9;

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      const result = await requestOtp(toE164(phone));
      // The name travels with the route: the account doesn't exist until the
      // code is verified, so there's nothing to attach it to before then.
      router.push({
        pathname: "/(auth)/verify",
        // No `returning` flag: this person is signing up, so the code screen
        // greets them as new rather than welcoming them back.
        params: {
          phone: result.phone,
          name: name.trim(),
          channel: result.channel,
        },
      });
    } catch (e) {
      setError(e as ApiError | NetworkError);
    } finally {
      setSubmitting(false);
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.brandMark}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.brandName}>Twogende</Text>
          </View>

          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.subheading}>
            We&apos;ll text you a code to confirm your number.
          </Text>

          {/* Server-level failures that aren't tied to one field. */}
          {error &&
          !(error instanceof ApiError && Object.keys(error.errors).length) ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error.message}</Text>
            </View>
          ) : null}

          <View style={styles.firstField}>
            <TextField
              label="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Achen Grace"
              error={fieldError("name")}
            />
          </View>

          <View style={styles.nextField}>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              hint="Ugandan mobile number"
              error={fieldError('phone')}
            />
          </View>

          <View style={styles.cta}>
            <Button
              label="Send me a code"
              onPress={submit}
              loading={submitting}
              disabled={ctaDisabled}
            />
          </View>

          <Text
            style={styles.switch}
            onPress={() => router.replace("/(auth)/login")}
          >
            I already have an account
          </Text>

          {/* Pushed to the bottom by the design's flex:1 spacer. */}
          <View style={styles.spacer} />

          <View style={styles.trust}>
            <ShieldCheck
              size={16}
              color={colors.acacia}
              strokeWidth={2}
              style={styles.trustIcon}
            />
            <Text style={styles.trustText}>
              Used only to verify your account and keep Twogende safe.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: 26,
    paddingHorizontal: 26,
    paddingBottom: 34,
  },

  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: 8,
  },
  brandName: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    letterSpacing: 0.5, // 0.04em at 12.5px
    textTransform: "uppercase",
    color: inkTints.brand,
  },

  heading: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    lineHeight: 32.2, // 1.15
    letterSpacing: -0.56, // -0.02em at 28px
    color: colors.ink,
  },
  subheading: {
    marginTop: 10,
    fontFamily: fonts.body.medium,
    fontSize: 15,
    lineHeight: 22.5, // 1.5
    color: inkTints.tagline,
  },

  banner: {
    marginTop: 18,
    backgroundColor: "rgba(192,81,46,0.10)",
    borderRadius: 16,
    padding: 13,
  },
  bannerText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    color: colors.terraDark,
  },

  firstField: { marginTop: 30 },
  nextField: { marginTop: 22 },

  cta: { marginTop: 28 },

  switch: {
    textAlign: "center",
    marginTop: 20,
    fontFamily: fonts.body.bold,
    fontSize: 14.5,
    color: colors.acaciaDark,
  },

  spacer: { flex: 1, minHeight: 28 },

  trust: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingHorizontal: 2,
  },
  trustIcon: { marginTop: 1 },
  trustText: {
    flex: 1,
    fontFamily: fonts.body.regular,
    fontSize: 12,
    lineHeight: 18, // 1.5
    color: inkTints.footnote,
  },
});
