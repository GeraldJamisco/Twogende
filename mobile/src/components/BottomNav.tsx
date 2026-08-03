import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { House, MessageCircle, Route, User } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, inkTints } from '../theme';

/**
 * Route name (the file in app/(tabs)) → icon and label.
 *
 * Search is deliberately absent. It's still a route — reached from the home
 * screen's "Find a ride" tile and its search pill — but it no longer holds a
 * place in the bar. Anything not listed here renders nothing, so a hidden tab
 * needs no special handling.
 */
const TABS: Record<string, { label: string; Icon: typeof House }> = {
  index: { label: 'Home', Icon: House },
  trips: { label: 'Trips', Icon: Route },
  chats: { label: 'Chats', Icon: MessageCircle },
  profile: { label: 'Profile', Icon: User },
};

/**
 * The design's nav bar, handed to expo-router as a custom tabBar rather than
 * restyling the default one.
 */
export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        // The design reserves 26px below the labels for the home indicator.
        // Android draws edge-to-edge from 15 onward, so honour the real inset
        // when it's larger than the designed allowance.
        { paddingBottom: Math.max(insets.bottom, 26) },
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;

        const isActive = state.index === index;
        const tint = isActive ? colors.terra : inkTints.timestamp;
        const { Icon, label } = tab;

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isActive && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            style={styles.item}
          >
            <Icon size={21} color={tint} strokeWidth={2} />
            <Text style={[styles.label, { color: tint }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fonts.body.bold,
    fontSize: 10,
  },
});
