import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { CalendarDays, ChevronLeft, ShieldCheck } from "../src/icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { submitIdentity, submitVehicle } from "../src/api/verification";
import { Button } from "../src/components/ui/Button";
import { ImageSlot } from "../src/components/ui/ImageSlot";
import { TextField } from "../src/components/ui/TextField";
import { useAuth } from "../src/state/AuthContext";
import { colors, fonts, inkTints } from "../src/theme";

type IdType = "license" | "national" | "passport";

/** Labels and placeholders per document, from the design's idMeta. */
const ID_META: Record<
  IdType,
  { label: string; numberLabel: string; placeholder: string; doc: string }
> = {
  license: {
    label: "Driver's license",
    numberLabel: "Driver's license number",
    placeholder: "DL-0234891",
    doc: "driver's license",
  },
  national: {
    label: "National ID",
    numberLabel: "National ID number",
    placeholder: "CM930817104XYZ",
    doc: "national ID",
  },
  passport: {
    label: "Passport",
    numberLabel: "Passport number",
    placeholder: "B0123456",
    doc: "passport",
  },
};

/** Implements "Twogende Driver Verification.dc.html". */
export default function Verification() {
  const { token, refreshUser } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 - identity
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [idType, setIdType] = useState<IdType>("license");
  const [idNumber, setIdNumber] = useState("");
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);

  // Step 2 - vehicle
  const [makeAndModel, setMakeAndModel] = useState("");
  const [colour, setColour] = useState("");
  const [plate, setPlate] = useState("");
  const [carPhoto, setCarPhoto] = useState<string | null>(null);

  const meta = ID_META[idType];

  // The design's own gating, plus the photos it asks for.
  const step1Filled =
    fullName.trim().length > 1 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    idNumber.trim().length > 3 &&
    Boolean(idPhoto) &&
    Boolean(selfie);

  const step2Filled =
    makeAndModel.trim().length > 1 &&
    colour.trim().length > 1 &&
    plate.trim().length >= 4 &&
    Boolean(carPhoto);

  function onDobChosen(event: DateTimePickerEvent, value?: Date) {
    setShowDobPicker(Platform.OS === "ios");
    if (event.type === "set" && value) {
      // The API wants YYYY-MM-DD; toISOString() would shift the day for
      // anyone east of UTC, which is everyone here.
      const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
      setDob(local.toISOString().slice(0, 10));
    }
  }

  async function onContinue() {
    if (!token) return;
    setError(null);

    if (step === 1) {
      setSubmitting(true);
      try {
        await submitIdentity(token, {
          fullName: fullName.trim(),
          dateOfBirth: dob,
          idType,
          idNumber: idNumber.trim(),
          idPhotoUri: idPhoto!,
          selfieUri: selfie!,
        });
        setStep(2);
      } catch (e) {
        // A submission already under review is fine - carry on to the vehicle.
        if ((e as { status?: number }).status === 409) {
          setStep(2);
        } else {
          setError((e as Error).message);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await submitVehicle(token, {
        makeAndModel: makeAndModel.trim(),
        colour: colour.trim(),
        plateLast4: plate.trim().toUpperCase(),
        photoUri: carPhoto!,
      });
      await refreshUser().catch(() => {});
      router.replace("/(tabs)/profile");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (step === 2 ? setStep(1) : router.back())}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <ChevronLeft size={18} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Driver verification</Text>
            <Text style={styles.stepLabel}>Step {step} of 2</Text>
          </View>
        </View>

        <View style={styles.progress}>
          <View style={[styles.bar, styles.barDone]} />
          <View style={[styles.bar, step === 2 && styles.barDone]} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={styles.heading}>Confirm your identity</Text>
                <Text style={styles.blurb}>
                  This stays private - passengers only ever see that you&apos;re
                  verified.
                </Text>

                <View style={styles.field}>
                  <TextField
                    label="Full legal name (as on ID)"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    placeholder="Achen Grace Nakato"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Date of birth</Text>
                  <Pressable
                    onPress={() => setShowDobPicker((open) => !open)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      dob ? `Date of birth ${dob}. Tap to change.` : "Choose your date of birth"
                    }
                    style={[styles.dateField, showDobPicker && styles.dateFieldOpen]}
                  >
                    <CalendarDays size={17} color={colors.ochre} strokeWidth={2.2} />
                    <Text style={[styles.dateValue, !dob && styles.datePlaceholder]}>
                      {dob ? formatLongDate(dob) : "Select your date of birth"}
                    </Text>
                  </Pressable>

                  {/*
                    Sits directly under its own field, as the design's
                    <input type="date"> does. On Android this is a native
                    dialog and placement makes no difference; on iOS the wheel
                    renders inline, and anywhere else on the screen would
                    detach it from the thing it edits.
                  */}
                  {showDobPicker ? (
                    <View style={styles.pickerHolder}>
                      <DateTimePicker
                        value={dob ? new Date(dob) : eighteenYearsAgo()}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        // Nobody under 18 may drive on Twogende, so the picker
                        // won't offer a date the API would only reject.
                        maximumDate={eighteenYearsAgo()}
                        minimumDate={new Date(1925, 0, 1)}
                        onChange={onDobChosen}
                      />
                    </View>
                  ) : null}
                </View>

                <Text style={styles.label}>ID type</Text>
                <View style={styles.segments}>
                  {(Object.keys(ID_META) as IdType[]).map((key) => {
                    const active = key === idType;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setIdType(key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        style={[styles.segment, active && styles.segmentActive]}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            active && styles.segmentLabelActive,
                          ]}
                        >
                          {ID_META[key].label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.field}>
                  <TextField
                    label={meta.numberLabel}
                    value={idNumber}
                    onChangeText={setIdNumber}
                    autoCapitalize="characters"
                    placeholder={meta.placeholder}
                    style={styles.idNumberInput}
                  />
                </View>

                <Text style={styles.label}>Photo of your {meta.doc}</Text>
                <View style={styles.slotWrap}>
                  <ImageSlot
                    placeholder="Upload a clear photo of your ID"
                    value={idPhoto}
                    onChange={setIdPhoto}
                  />
                </View>

                <Text style={styles.label}>A quick selfie</Text>
                <Text style={styles.subLabel}>
                  Matched against your ID photo to confirm it&apos;s really you.
                </Text>
                <View style={styles.selfieRow}>
                  <ImageSlot
                    placeholder="Take a selfie"
                    value={selfie}
                    onChange={setSelfie}
                    shape="circle"
                    source="camera"
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.heading}>Add your vehicle</Text>
                <Text style={styles.blurb}>
                  Helps passengers recognize your car and confirms it&apos;s
                  registered.
                </Text>

                <View style={styles.field}>
                  <TextField
                    label="Make & model"
                    value={makeAndModel}
                    onChangeText={setMakeAndModel}
                    autoCapitalize="words"
                    placeholder="Toyota Premio"
                  />
                </View>

                <View style={styles.field}>
                  <TextField
                    label="Color"
                    value={colour}
                    onChangeText={setColour}
                    autoCapitalize="words"
                    placeholder="Silver"
                  />
                </View>

                <View style={styles.field}>
                  <TextField
                    label="Last 4 of number plate"
                    value={plate}
                    onChangeText={(next) =>
                      setPlate(next.replace(/[^A-Za-z0-9]/g, "").slice(0, 4))
                    }
                    autoCapitalize="characters"
                    placeholder="402K"
                    maxLength={4}
                    style={styles.plateInput}
                  />
                </View>

                <Text style={styles.label}>Photo of your car</Text>
                <View style={styles.slotWrap}>
                  <ImageSlot
                    placeholder="Upload a photo showing the plate"
                    value={carPhoto}
                    onChange={setCarPhoto}
                  />
                </View>

                <View style={styles.trust}>
                  <ShieldCheck
                    size={16}
                    color={colors.acacia}
                    strokeWidth={2}
                    style={styles.trustIcon}
                  />
                  <Text style={styles.trustText}>
                    Passengers only see your first name, photo, rating,
                    verification badges and vehicle - never your ID, license or
                    plate number.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <Button
            label={step === 1 ? "Continue" : "Submit for verification"}
            onPress={onContinue}
            loading={submitting}
            disabled={step === 1 ? !step1Filled : !step2Filled}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function eighteenYearsAgo(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date;
}

/** "18 March 1994" - clearer than a bare YYYY-MM-DD on a form. */
function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 4,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: fonts.display.bold,
    fontSize: 19,
    letterSpacing: -0.19,
    color: colors.ink,
  },
  stepLabel: {
    marginTop: 2,
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    color: inkTints.placeholder,
  },

  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 22, paddingTop: 14 },
  bar: { flex: 1, height: 4, borderRadius: 3, backgroundColor: colors.divider },
  barDone: { backgroundColor: colors.terraDark },

  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22 },

  heading: {
    fontFamily: fonts.display.bold,
    fontSize: 22,
    letterSpacing: -0.44,
    color: colors.ink,
    marginBottom: 6,
  },
  blurb: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    lineHeight: 21,
    color: inkTints.tagline,
    marginBottom: 22,
  },

  field: { marginBottom: 18 },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  dateValue: {
    flex: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 16,
    color: colors.ink,
  },
  datePlaceholder: { color: inkTints.inputPlaceholder },
  dateFieldOpen: { borderColor: colors.terra },
  pickerHolder: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  idNumberInput: { letterSpacing: 0.31 },
  plateInput: { letterSpacing: 1.86, textTransform: "uppercase", fontFamily: fonts.body.bold },

  label: {
    fontFamily: fonts.body.extraBold,
    fontSize: 12.5,
    letterSpacing: 0.375,
    textTransform: "uppercase",
    color: inkTints.label,
    marginBottom: 8,
  },
  subLabel: {
    fontFamily: fonts.body.regular,
    fontSize: 12.5,
    lineHeight: 18.75,
    color: inkTints.placeholder,
    marginBottom: 10,
    marginTop: -2,
  },

  segments: { flexDirection: "row", gap: 8, marginBottom: 18 },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  segmentActive: {
    borderColor: colors.terraDark,
    backgroundColor: colors.terraDark,
  },
  segmentLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: colors.ink,
    textAlign: "center",
  },
  segmentLabelActive: { color: "#fff" },

  slotWrap: { marginBottom: 18 },
  selfieRow: { alignItems: "center" },

  trust: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 16,
    paddingHorizontal: 2,
  },
  trustIcon: { marginTop: 1 },
  trustText: {
    flex: 1,
    fontFamily: fonts.body.regular,
    fontSize: 12,
    lineHeight: 18,
    color: inkTints.footnote,
  },

  errorBanner: {
    backgroundColor: "rgba(192,81,46,0.10)",
    borderRadius: 16,
    padding: 13,
    marginBottom: 18,
  },
  errorText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    color: colors.terraDark,
  },

  footer: { paddingHorizontal: 22, paddingBottom: 30, paddingTop: 4 },
});
