import { Link, router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/ui/Button';
import { colors, fonts, gutter, inkTints } from '../../src/theme';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brand}>
        <Image
          source={require('../../assets/adaptive-icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.wordmark}>Twogende</Text>
        <Text style={styles.tagline}>Share the ride, split the cost.</Text>
      </View>

      <View style={styles.actions}>
        <Button label="Create an account" onPress={() => router.push('/(auth)/register')} />
        <Link href="/(auth)/login" asChild>
          <Text style={styles.secondary}>I already have an account</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: gutter,
    justifyContent: 'space-between',
    paddingBottom: 32,
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    width: 64,
    height: 64,
  },
  wordmark: {
    fontFamily: fonts.display.bold,
    fontSize: 40,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  tagline: {
    fontFamily: fonts.body.medium,
    fontSize: 15,
    color: inkTints.tagline,
  },
  actions: {
    gap: 16,
  },
  secondary: {
    textAlign: 'center',
    fontFamily: fonts.body.bold,
    fontSize: 14,
    color: colors.acaciaDark,
    paddingVertical: 8,
  },
});
