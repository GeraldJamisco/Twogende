import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors, fonts, inkTints } from '../../theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
};

/**
 * Field styling taken from "Twogende Register.dc.html": 12.5px ExtraBold
 * uppercase label, 1.5px divider border on a surface fill at 16px radius, and
 * 16px SemiBold text inside 16px of padding.
 *
 * The design's focus state also draws a 3px terracotta glow ring
 * (box-shadow: 0 0 0 3px rgba(192,81,46,.14)). React Native has no spread
 * shadow, so only the border colour change survives the translation.
 */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error ? styles.fieldInvalid : null,
        ]}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={inkTints.inputPlaceholder}
          accessibilityLabel={label}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, style]}
          {...props}
        />
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.body.extraBold,
    fontSize: 12.5,
    letterSpacing: 0.375, // 0.03em at 12.5px
    textTransform: 'uppercase',
    color: inkTints.label,
    marginBottom: 8,
  },
  field: {
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  fieldFocused: {
    borderColor: colors.terra,
  },
  fieldInvalid: {
    borderColor: colors.terra,
  },
  input: {
    padding: 16,
    fontFamily: fonts.body.semiBold,
    fontSize: 16,
    color: colors.ink,
  },
  error: {
    marginTop: 8,
    fontFamily: fonts.body.medium,
    fontSize: 13,
    color: colors.terraDark,
  },
  hint: {
    marginTop: 8,
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: inkTints.label,
  },
});
