import { Car, Search } from "../icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, gutter } from "../theme";

type Props = {
  onOfferRide?: () => void;
  onFindRide?: () => void;
};

/**
 * The two primary calls to action the whole product in one row: post a trip
 * you're already making, or find one going your way.
 */
export function ActionTiles({ onOfferRide, onFindRide }: Props) {
  return (
    <View style={styles.row}>
      <Tile
        label="Offer a ride"
        background={colors.terra}
        foreground={colors.onTerra}
        icon={<Car size={21} color={colors.onTerra} strokeWidth={2} />}
        onPress={onOfferRide}
      />
      <Tile
        label="Find a ride"
        background={colors.acacia}
        foreground={colors.onAcacia}
        icon={<Search size={20} color={colors.onAcacia} strokeWidth={2} />}
        onPress={onFindRide}
      />
    </View>
  );
}

type TileProps = {
  label: string;
  background: string;
  foreground: string;
  icon: React.ReactNode;
  onPress?: () => void;
};

function Tile({ label, background, foreground, icon, onPress }: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // .wg-tile:active nudges the tile down 1px; there is no hover on device.
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: background },
        pressed && styles.tilePressed,
      ]}
    >
      {icon}
      <Text style={[styles.tileLabel, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: gutter,
  },
  tile: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tilePressed: {
    transform: [{ translateY: 1 }],
  },
  tileLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15,
    letterSpacing: -0.15, // -0.01em at 15px
  },
});
