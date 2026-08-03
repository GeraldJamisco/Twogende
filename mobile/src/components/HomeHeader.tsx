import { User } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gutter, inkTints } from '../theme';

type Props = {
  onOpenProfile?: () => void;
};

export function HomeHeader({ onOpenProfile }: Props) {
  return (
    <View style={styles.container}>
      <View>
        <View style={styles.wordmarkRow}>
          <Image
            source={require('../../assets/adaptive-icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.wordmark}>Twogende</Text>
        </View>
        <Text style={styles.tagline}>Share the ride, split the cost.</Text>
      </View>

      <Pressable
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel="Your profile"
        style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}
      >
        <User size={19} color={colors.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingHorizontal: gutter,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logo: {
    width: 32,
    height: 32,
  },
  wordmark: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.84, // -0.03em at 28px
    color: colors.ink,
    includeFontPadding: false,
  },
  tagline: {
    marginTop: 8,
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: inkTints.tagline,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButtonPressed: {
    backgroundColor: colors.cream,
  },
});
