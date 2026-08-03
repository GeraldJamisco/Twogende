import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../../theme';

type Variant = 'primary' | 'secondary' | 'quiet';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
};

/**
 * The primary CTA is taken from "Twogende Register.dc.html": deep terracotta
 * (--wg-terra-d) on white, 16px radius, 17px vertical padding, Inter ExtraBold
 * at 16.5px, with a soft terracotta drop shadow. Disabled drops to 45% and
 * pressing nudges it down 1px.
 */
export function Button({ label, onPress, variant = 'primary', loading, disabled, icon }: Props) {
  const inactive = disabled || loading;
  const palette = PALETTE[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        variant === 'primary' && styles.primaryShadow,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.foreground} size="small" />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const PALETTE: Record<Variant, { background: string; foreground: string; border: string }> = {
  primary: { background: colors.terraDark, foreground: '#ffffff', border: colors.terraDark },
  secondary: { background: colors.acacia, foreground: colors.onAcacia, border: colors.acacia },
  quiet: { background: colors.surface, foreground: colors.ink, border: colors.divider },
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    borderWidth: 0,
    paddingVertical: 17,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryShadow: {
    // 0 6px 16px -4px rgba(162,66,31,.55). React Native has no negative
    // spread, so the radius is trimmed to compensate.
    shadowColor: colors.terraDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  inactive: {
    opacity: 0.45,
  },
  label: {
    fontFamily: fonts.body.extraBold,
    fontSize: 16.5,
    letterSpacing: -0.165, // -0.01em at 16.5px
  },
});
