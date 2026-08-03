import { Calendar, Search } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, gutter, inkTints } from '../theme';

type Props = {
  /** Rendered as-is: "Kampala → Where to? · Today". */
  summary?: string;
  onPress?: () => void;
};

/**
 * A button, not a text field. Tapping it opens the search screen; the design
 * shows the current query as a summary line.
 */
export function SearchPill({ summary = 'Kampala → Where to? · Today', onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Search rides. Current search: ${summary}`}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <Search size={18} color={colors.terra} strokeWidth={2} />
      <Text style={styles.summary} numberOfLines={1}>
        {summary}
      </Text>
      <Calendar size={16} color={colors.ochre} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    marginTop: 14,
    marginBottom: 4,
    marginHorizontal: gutter,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pillPressed: {
    backgroundColor: colors.cream,
  },
  summary: {
    flex: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 14.5,
    color: inkTints.placeholder,
  },
});
