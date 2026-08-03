import { Image, StyleSheet, Text, View } from "react-native";

import { fonts, inkTints } from "../theme";

type Props = {
  name: string;
  photoUrl: string | null;
  size?: number;
};

/**
 * The design uses an empty <image-slot> here a drag-to-fill placeholder that
 * only exists on the Claude Design canvas. On device that becomes the driver's
 * real photo, falling back to their initial rather than an empty grey disc.
 */
export function Avatar({ name, photoUrl, size = 44 }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={shape}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[styles.fallback, shape]}>
      <Text style={[styles.initial, { fontSize: size * 0.36 }]}>
        {initialOf(name)}
      </Text>
    </View>
  );
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "rgba(43,32,24,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontFamily: fonts.body.bold,
    color: inkTints.meta,
    includeFontPadding: false,
  },
});
