import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { fontAssets } from "../src/fonts";
import { AuthProvider } from "../src/state/AuthContext";
import { colors } from "../src/theme";

// Hold the splash screen until the fonts are ready, so the first paint isn't
// the system face snapping to Fraunces a frame later.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    // Hide on error too a missing font shouldn't strand the user on a splash
    // screen; the OS fallback face is better than nothing.
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {/* Cream background, so the status bar needs dark glyphs. */}
      <StatusBar style="dark" />
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.cream },
          }}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
