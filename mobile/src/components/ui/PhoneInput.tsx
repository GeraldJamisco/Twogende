import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors, fonts, inkTints } from '../../theme';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label?: string;
  /** National digits only - the +256 is fixed and not part of the value. */
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
};

/** Uganda is the only market in phase 1, so the country code is not a choice. */
const COUNTRY_CODE = '+256';

/**
 * Phone entry with the country code locked.
 *
 * The +256 is displayed, not typed: it can't be deleted, and it isn't part of
 * the value the caller receives. That removes the commonest way people get a
 * number wrong - half-typing a country code on top of a local one.
 *
 * Field styling matches the design's inputs exactly (1.5px divider border,
 * 16px radius, surface fill, terracotta on focus).
 */
export const PhoneInput = forwardRef<TextInput, Props>(function PhoneInput(
  { label = 'Phone number', value, onChangeText, error, hint, onFocus, onBlur, style, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.field, focused && styles.fieldFocused, error ? styles.fieldInvalid : null]}>
        <View style={styles.prefix}>
          <Text style={styles.prefixText}>{COUNTRY_CODE}</Text>
        </View>
        <View style={styles.divider} />

        <TextInput
          ref={ref}
          value={value}
          // Digits only. A pasted "+256 701..." or a habitual leading zero is
          // stripped here rather than being rejected later by the API.
          onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, 10))}
          keyboardType="number-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="701 234 567"
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

/** National digits entered so far, for enabling a submit button. */
export function phoneDigitCount(value: string): number {
  return value.replace(/\D/g, '').replace(/^0+/, '').length;
}

/** What the API expects: the fixed country code plus what was typed. */
export function toE164(value: string): string {
  return COUNTRY_CODE + value.replace(/\D/g, '').replace(/^0+/, '');
}

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
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  fieldFocused: { borderColor: colors.terra },
  fieldInvalid: { borderColor: colors.terra },
  prefix: {
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 16,
  },
  prefixText: {
    fontFamily: fonts.body.bold,
    fontSize: 16,
    color: inkTints.label,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 10,
    backgroundColor: colors.divider,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    fontFamily: fonts.body.semiBold,
    fontSize: 16,
    letterSpacing: 0.32, // 0.02em at 16px, as the design sets on phone fields
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
