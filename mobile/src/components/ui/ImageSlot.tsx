import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus } from "lucide-react-native";
import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, inkTints } from "../../theme";

type Props = {
  /** Empty-state prompt, e.g. "Upload a clear photo of your ID". */
  placeholder: string;
  value: string | null;
  onChange: (uri: string | null) => void;
  shape?: "rounded" | "circle";
  height?: number;
  /** Circle slots on this screen are selfies, so they open the camera. */
  source?: "library" | "camera";
};

/**
 * The React Native equivalent of the design's <image-slot> — a tappable
 * placeholder that fills with a photo.
 *
 * The web component lets you drag a file in; on a handset that becomes the
 * photo library or the camera.
 */
export function ImageSlot({
  placeholder,
  value,
  onChange,
  shape = "rounded",
  height = 150,
  source = "library",
}: Props) {
  const [busy, setBusy] = useState(false);

  const circle = shape === "circle";
  const frame = circle
    ? { width: height, height, borderRadius: height / 2 }
    : { width: "100%" as const, height, borderRadius: 16 };

  async function pick() {
    setBusy(true);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          source === "camera" ? "Camera access needed" : "Photo access needed",
          "Twogende needs this to confirm your identity. You can enable it in Settings.",
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ quality: 0.7, cameraType: ImagePicker.CameraType.front })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.7,
              mediaTypes: ["images"],
            });

      if (!result.canceled && result.assets[0]) {
        onChange(result.assets[0].uri);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={pick}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={value ? `${placeholder}. Photo added. Tap to replace.` : placeholder}
      style={({ pressed }) => [
        styles.slot,
        frame,
        value ? styles.slotFilled : null,
        pressed && styles.pressed,
      ]}
    >
      {value ? (
        <Image
          source={{ uri: value }}
          style={[styles.preview, frame]}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.empty}>
          {source === "camera" ? (
            <Camera size={22} color={inkTints.inputPlaceholder} strokeWidth={2} />
          ) : (
            <ImagePlus size={22} color={inkTints.inputPlaceholder} strokeWidth={2} />
          )}
          <Text style={styles.placeholder}>{placeholder}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderStyle: "dashed",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  slotFilled: { borderStyle: "solid", borderColor: colors.acacia },
  preview: { resizeMode: "cover" },
  empty: { alignItems: "center", gap: 8, paddingHorizontal: 18 },
  placeholder: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: inkTints.inputPlaceholder,
    textAlign: "center",
  },
  pressed: { opacity: 0.85 },
});
