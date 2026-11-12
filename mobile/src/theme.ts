/**
 * Design tokens lifted verbatim from the Claude Design source
 * ("Twogende Home.dc.html" → the --wg-* custom properties).
 *
 * Values are exact. If a colour looks wrong on device, fix it in the design
 * project and re-import rather than nudging it here.
 */

export const colors = {
  cream: "#f4ecdc", // --wg-cream, the screen background
  surface: "#fcf7ec", // --wg-surface, cards / nav bar / inputs
  ink: "#2b2018", // --wg-ink
  terra: "#c0512e", // --wg-terra, primary action + contribution figures
  terraDark: "#a2421f", // --wg-terra-d
  acacia: "#6c7a45", // --wg-acacia, secondary action + live indicator
  acaciaDark: "#586537", // --wg-acacia-d
  ochre: "#cf9a45", // --wg-ochre, stars + calendar
  divider: "rgba(43,32,24,0.14)", // --wg-divider

  /** Foreground colours the design pairs with the two filled buttons. */
  onTerra: "#fbf3e8",
  onAcacia: "#f6f4e6",
} as const;

/**
 * The design tints the ink at four fixed opacities. Named by the role each one
 * plays rather than by its alpha, so call sites read as intent.
 */
export const inkTints = {
  tagline: "rgba(43,32,24,0.62)",
  meta: "rgba(43,32,24,0.60)",
  /** Field labels and helper text "Twogende Register.dc.html". */
  label: "rgba(43,32,24,0.55)",
  placeholder: "rgba(43,32,24,0.50)",
  /** Small print under the fold, e.g. the trust note on Register. */
  footnote: "rgba(43,32,24,0.50)",
  timestamp: "rgba(43,32,24,0.45)",
  /** The small uppercase wordmark beside the brand mark. */
  brand: "rgba(43,32,24,0.42)",
  /** An unmet verification state on the profile - "Not yet". */
  notYet: "rgba(43,32,24,0.40)",
  /** Placeholder text inside an input. Lighter than a label. */
  inputPlaceholder: "rgba(43,32,24,0.38)",
} as const;

/**
 * The seat-count pill. The mockup shows two tones see src/data/rides.ts for
 * why the choice currently travels with the fixture data.
 */
export const seatBadgeTones = {
  acacia: {
    background: "rgba(108,122,69,0.16)",
    foreground: colors.acaciaDark,
  },
  ochre: { background: "rgba(207,154,69,0.20)", foreground: "#a06f1f" },
  /** Added by the search results design, for its quietest seat pill. */
  neutral: {
    background: "rgba(43,32,24,0.08)",
    foreground: "rgba(43,32,24,0.55)",
  },
} as const;

export type SeatBadgeTone = keyof typeof seatBadgeTones;

/**
 * The urgency pill on trip cards, from "Twogende Search Results.dc.html".
 *
 * Only "Leaving now" carries a dot - it's the one state that wants to catch
 * the eye, and giving every pill a dot would defeat that.
 */
export const urgencyTones = {
  /** Already under way, or departed within the grace window. */
  underway: {
    background: "rgba(108,122,69,0.16)",
    foreground: colors.acaciaDark,
    dot: false,
  },
  /** About to leave. */
  now: {
    background: "rgba(192,81,46,0.14)",
    foreground: colors.terraDark,
    dot: true,
  },
  /** Within the hour. */
  soon: {
    background: "rgba(207,154,69,0.20)",
    foreground: "#a06f1f",
    dot: false,
  },
  /** Further out - deliberately the quietest. */
  later: {
    background: "rgba(43,32,24,0.08)",
    foreground: "rgba(43,32,24,0.55)",
    dot: false,
  },
} as const;

export type UrgencyTone = keyof typeof urgencyTones;

/**
 * React Native picks a font file by family name, not by weight, so every
 * weight the design uses is its own loaded family.
 */
export const fonts = {
  /** Fraunces headings only, per the .wg-screen h1/h2/h3 rule. */
  display: {
    regular: "Fraunces_400Regular",
    semiBold: "Fraunces_600SemiBold",
    bold: "Fraunces_700Bold",
  },
  /** Inter everything else. */
  body: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semiBold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
    extraBold: "Inter_800ExtraBold",
  },
} as const;

/** Horizontal gutter the design uses for every section (22px). */
export const gutter = 22;
