/**
 * Font assets, imported by exact file path rather than through the
 * @expo-google-fonts barrel.
 *
 * The barrel's index.js `require()`s every weight and italic in the family, so
 * importing from it drags all 18 faces of each family into the bundle about
 * 12MB for the 8 we actually use. On a market that is ~95% Android, much of it
 * budget hardware on metered data, that is not a rounding error.
 *
 * Keys must match the fontFamily strings in theme.ts.
 */
export const fontAssets = {
  Fraunces_400Regular: require("@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf"),
  Fraunces_600SemiBold: require("@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf"),
  Fraunces_700Bold: require("@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf"),
  Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
  Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
  Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
  Inter_700Bold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
  Inter_800ExtraBold: require("@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf"),
};
