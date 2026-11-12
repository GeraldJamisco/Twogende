import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ActiveRideBar } from "../../src/components/ActiveRideBar";
import { BottomNav } from "../../src/components/BottomNav";
import { useAuth } from "../../src/state/AuthContext";
import { colors } from "../../src/theme";

/**
 * The signed-in shell. The tab bar is the one from the design BottomNav is
 * handed to expo-router as a custom tabBar rather than restyling the default.
 */
export default function TabsLayout() {
  const { loading, token } = useAuth();

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.terra} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.cream },
      }}
      /*
       * The active-ride bar rides directly above the nav rather than living on
       * the home screen, so it stays put on every tab for the whole of a
       * journey. It renders nothing when there's no ride.
       */
      tabBar={(props) => (
        <View>
          {/* Renders nothing at all when there's no ride, spacing included. */}
          <ActiveRideBar />
          <BottomNav {...props} />
        </View>
      )}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="trips" options={{ title: "Trips" }} />
      <Tabs.Screen name="chats" options={{ title: "Chats" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />

      {/*
        Search keeps its screens but loses its place in the bar. href: null
        hides the tab while leaving the route navigable from the home screen.
      */}
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
});
