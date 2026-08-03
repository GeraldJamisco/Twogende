import { Stack } from "expo-router";

import { colors } from "../../../src/theme";

/**
 * The search tab is a stack: the form and its results are two screens in the
 * designs, and keeping them here means the tab bar stays put and the back
 * button on the results screen behaves.
 */
export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    />
  );
}
