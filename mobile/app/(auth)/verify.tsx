import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { requestOtp, updateProfile, verifyOtp } from "../../src/api/auth";
import { ApiError, NetworkError } from "../../src/api/client";
import { Button } from "../../src/components/ui/Button";
import { TextField } from "../../src/components/ui/TextField";
import { useAuth } from "../../src/state/AuthContext";
import { colors, fonts, inkTints } from "../../src/theme";

export default function Verify() {
  // `name` is carried from the sign-up screen: the account doesn't exist until
  // the code below is verified, so there was nothing to attach it to earlier.
  const { phone, name, greetingName, channel } = useLocalSearchParams<{
    phone: string;
    name?: string;
    /** Set when the sign-in screen recognised the number. */
    greetingName?: string;
    /** Which channel actually carried the code — "whatsapp" or "sms". */
    channel?: string;
  }>();

  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
  const { signIn } = useAuth();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | NetworkError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Countdown on the resend button, so the wait is visible rather than a
  // button that silently refuses.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await verifyOtp({ phone, code, device_name: "mobile" });

      // A brand-new account has no name yet. If one was collected on the way
      // in, set it before the app opens.
      let user = result.user;
      if (result.is_new && name) {
        try {
          user = (await updateProfile(result.token, { name })).data;
        } catch {
          // Not worth blocking sign-in over the profile screen can fix it.
        }
      }

      await signIn(result.token, user);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e as ApiError | NetworkError);
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      const result = await requestOtp(phone);
      setNotice(result.message);
      setCooldown(result.resend_after_seconds ?? 60);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setCooldown(e.retryAfterSeconds ?? 60);
        setNotice("Please wait before requesting another code.");
        return;
      }
      setError(e as ApiError | NetworkError);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.heading}>
          {greetingName ? `Welcome back, ${greetingName}` : 'Enter your code'}
        </Text>
        <Text style={styles.subheading}>
          We sent a 6-digit code to {phone} via {channelLabel}.
        </Text>

        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error.message}</Text>
          </View>
        ) : notice ? (
          <View style={[styles.banner, styles.bannerCalm]}>
            <Text style={[styles.bannerText, styles.bannerCalmText]}>
              {notice}
            </Text>
          </View>
        ) : null}

        <TextField
          label="Verification code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          placeholder="123456"
          style={styles.codeInput}
          error={
            error instanceof ApiError ? error.fieldError("code") : undefined
          }
        />

        <Button
          label="Verify"
          onPress={submit}
          loading={submitting}
          disabled={code.length < 6}
        />

        <Button
          label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          variant="quiet"
          onPress={resend}
          disabled={cooldown > 0}
        />

        <Text style={styles.switch} onPress={() => router.back()}>
          Wrong number? Go back
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 26, gap: 18 },
  heading: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    letterSpacing: -0.56,
    color: colors.ink,
  },
  subheading: {
    fontFamily: fonts.body.medium,
    fontSize: 15,
    color: inkTints.tagline,
    marginTop: -12,
  },
  codeInput: {
    fontSize: 26,
    letterSpacing: 8,
    textAlign: "center",
    fontFamily: fonts.body.extraBold,
  },
  banner: {
    backgroundColor: "rgba(192,81,46,0.10)",
    borderRadius: 16,
    padding: 13,
  },
  bannerCalm: { backgroundColor: "rgba(108,122,69,0.14)" },
  bannerText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    color: colors.terraDark,
  },
  bannerCalmText: { color: colors.acaciaDark },
  switch: {
    textAlign: "center",
    fontFamily: fonts.body.bold,
    fontSize: 14.5,
    color: colors.acaciaDark,
    paddingVertical: 8,
  },
});
