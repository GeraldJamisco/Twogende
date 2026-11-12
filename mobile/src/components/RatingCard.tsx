import { Lock, Star } from "../icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { RatingTag, TagsByStars, TheirRating } from "../api/ratings";
import { Avatar } from "./Avatar";
import { colors, fonts, inkTints } from "../theme";

/** The word under the stars, from both Trip Complete designs. */
const LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent!",
};

export type RatingDraft = {
  stars: number;
  tags: string[];
  comment: string;
};

type Props = {
  /** "How was your ride with David?" / "How was Sarah as a passenger?" */
  question: string;
  /** The line under the question - a pickup point, or a route. */
  subtitle?: string | null;
  name: string;
  photoUrl: string | null;
  tagsByStars: TagsByStars;
  chipsBeforeMore: number;
  draft: RatingDraft;
  onChange: (draft: RatingDraft) => void;
  /** What they said about you - sealed until this rating is submitted. */
  theirRating?: TheirRating;
  disabled?: boolean;
};

/**
 * One "rate this person" card. The passenger's screen shows exactly one; the
 * driver's shows one per passenger, which is why this is a component rather
 * than part of a screen.
 */
export function RatingCard({
  question,
  subtitle,
  name,
  photoUrl,
  tagsByStars,
  chipsBeforeMore,
  draft,
  onChange,
  theirRating,
  disabled = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const offered: RatingTag[] = useMemo(
    () => (draft.stars > 0 ? (tagsByStars[String(draft.stars)] ?? []) : []),
    [draft.stars, tagsByStars],
  );

  const visible = expanded ? offered : offered.slice(0, chipsBeforeMore);
  const hiddenCount = offered.length - visible.length;

  /*
   * Changing the star count changes which chips are on offer, so any already
   * chosen have to go. Keeping them would post a tag the server rejects for
   * that rating, and the whole submission would fail on a tap the user made
   * before they changed their mind.
   */
  function setStars(stars: number) {
    onChange({ ...draft, stars, tags: [] });
    setExpanded(false);
  }

  function toggleTag(slug: string) {
    onChange({
      ...draft,
      tags: draft.tags.includes(slug)
        ? draft.tags.filter((t) => t !== slug)
        : [...draft.tags, slug],
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Avatar name={name} photoUrl={photoUrl} size={52} />
        <View style={styles.headText}>
          <Text style={styles.question}>{question}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            disabled={disabled}
            onPress={() => setStars(n)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${n} ${n === 1 ? "star" : "stars"}`}
          >
            <Star
              size={34}
              color={colors.ochre}
              strokeWidth={1.6}
              // The design fills the chosen stars and leaves the rest outlined.
              fill={n <= draft.stars ? colors.ochre : "transparent"}
            />
          </Pressable>
        ))}
      </View>

      <Text style={styles.ratingLabel}>{LABELS[draft.stars] ?? ""}</Text>

      {draft.stars > 0 ? (
        <View style={styles.chips}>
          {visible.map((tag) => {
            const chosen = draft.tags.includes(tag.slug);

            return (
              <Pressable
                key={tag.slug}
                disabled={disabled}
                onPress={() => toggleTag(tag.slug)}
                style={[styles.chip, chosen && styles.chipChosen]}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
              >
                <Text style={[styles.chipText, chosen && styles.chipTextChosen]}>
                  {tag.label}
                </Text>
              </Pressable>
            );
          })}

          {hiddenCount > 0 ? (
            <Pressable
              onPress={() => setExpanded(true)}
              style={[styles.chip, styles.chipMore]}
              accessibilityRole="button"
            >
              <Text style={styles.chipMoreText}>+ {hiddenCount} more</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <TextInput
        value={draft.comment}
        onChangeText={(comment) => onChange({ ...draft, comment })}
        editable={!disabled}
        placeholder="Add a comment (optional)"
        placeholderTextColor={inkTints.inputPlaceholder}
        multiline
        style={styles.comment}
      />

      {theirRating ? <TheirVerdict name={name} theirRating={theirRating} /> : null}
    </View>
  );
}

/**
 * The sealed card. Its whole job is to give somebody a reason to finish the
 * screen - they can see a verdict exists and not what it says.
 */
function TheirVerdict({
  name,
  theirRating,
}: {
  name: string;
  theirRating: TheirRating;
}) {
  if (!theirRating.waiting) return null;

  if (!theirRating.revealed) {
    return (
      <View style={styles.sealed}>
        <Lock size={15} color={inkTints.label} strokeWidth={2.2} />
        <Text style={styles.sealedText}>
          {name} rated you.{" "}
          <Text style={styles.sealedCta}>Rate to see it</Text>
        </Text>
      </View>
    );
  }

  const rating = theirRating.rating;
  if (!rating) return null;

  return (
    <View style={styles.revealed}>
      <View style={styles.revealedHead}>
        <Text style={styles.revealedTitle}>{name} rated you</Text>
        <View style={styles.revealedStars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={14}
              color={colors.ochre}
              strokeWidth={1.8}
              fill={n <= rating.stars ? colors.ochre : "transparent"}
            />
          ))}
        </View>
      </View>
      {rating.comment ? (
        <Text style={styles.revealedComment}>“{rating.comment}”</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 18,
    paddingTop: 20,
    marginTop: 14,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  headText: { flex: 1 },
  question: {
    fontFamily: fonts.body.extraBold,
    fontSize: 16,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: inkTints.label,
    marginTop: 2,
  },

  stars: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  ratingLabel: {
    textAlign: "center",
    marginTop: 8,
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: colors.ochre,
    // Reserved even when empty, so choosing a star doesn't shunt the chips down.
    minHeight: 16,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.cream,
  },
  chipChosen: {
    borderColor: colors.acacia,
    backgroundColor: "rgba(108,122,69,0.16)",
  },
  chipText: {
    fontFamily: fonts.body.bold,
    fontSize: 12,
    color: colors.ink,
  },
  chipTextChosen: { color: colors.acaciaDark },
  chipMore: { borderStyle: "dashed" },
  chipMoreText: {
    fontFamily: fonts.body.bold,
    fontSize: 12,
    color: inkTints.label,
  },

  comment: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.ink,
    minHeight: 60,
    textAlignVertical: "top",
  },

  sealed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  sealedText: {
    flex: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    color: inkTints.label,
  },
  sealedCta: { fontFamily: fonts.body.extraBold, color: colors.terra },

  revealed: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  revealedHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  revealedTitle: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: inkTints.label,
  },
  revealedStars: { flexDirection: "row", gap: 2 },
  revealedComment: {
    marginTop: 6,
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.ink,
    fontStyle: "italic",
  },
});
