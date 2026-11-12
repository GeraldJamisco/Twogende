import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteAccount,
  platformConfig,
  updateNotifications,
  type PaymentMethodOption,
  type PlatformConfig,
} from "../src/api/account";
import { ApiError, NetworkError } from "../src/api/client";
import {
  DATA_CATEGORIES,
  DELETION_REASONS,
  PRIVACY,
  TERMS,
  fillDoc,
  type LegalDoc,
} from "../src/content/legal";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  X,
} from "../src/icons";
import { formatInternational } from "../src/lib/format";
import { useAuth } from "../src/state/AuthContext";
import { colors, fonts, inkTints } from "../src/theme";

/**
 * Implements "Twogende Settings.dc.html" - one screen, five views.
 *
 * The views are internal state rather than five routes, because that is how
 * the design behaves: back always returns to the list, never to the view
 * before it. Five routes would give Android's back button a history to walk
 * that the design does not have.
 */
type SettingsView =
  | "settings"
  | "language"
  | "payment"
  | "privacy"
  | "terms"
  | "data"
  | "delete"
  | "done";

const TITLES: Record<SettingsView, string> = {
  settings: "Settings",
  language: "Language",
  payment: "Payment methods",
  privacy: "Privacy policy",
  terms: "Terms of service",
  data: "Data safety",
  delete: "Delete account",
  done: "",
};

export default function SettingsScreen() {
  const { token, user, signOut } = useAuth();

  const [view, setView] = useState<SettingsView>("settings");
  const [config, setConfig] = useState<PlatformConfig | null>(null);

  const [rideUpdates, setRideUpdates] = useState(true);
  const [marketing, setMarketing] = useState(false);

  const [reason, setReason] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRideUpdates(user.notifications?.ride_updates ?? true);
      setMarketing(user.notifications?.marketing ?? false);
    }
  }, [user]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setConfig((await platformConfig(token)).data);
    } catch {
      // The screen is readable without it; only the fee percentage in the
      // Terms depends on it, and that renders as "our fee" until it arrives.
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Saved as it is flipped, and rolled back if the server refuses. A switch
   * that springs back is honest; one that stays on while the preference never
   * saved is a lie the user only discovers from an unwanted message.
   */
  async function toggle(key: "ride_updates" | "marketing", next: boolean) {
    if (!token) return;

    const set = key === "ride_updates" ? setRideUpdates : setMarketing;
    set(next);

    try {
      await updateNotifications(
        token,
        key === "ride_updates"
          ? { notify_ride_updates: next }
          : { notify_marketing: next },
      );
    } catch {
      set(!next);
    }
  }

  async function confirmDelete() {
    if (!token || !confirmed) return;

    setBusy(true);
    setError(null);

    try {
      await deleteAccount(token, reason ?? undefined);
      setView("done");
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof NetworkError
          ? e.message
          : "Could not close your account.",
      );
    } finally {
      setBusy(false);
    }
  }

  const fee = config
    ? `${Math.round(config.commission_rate * 100)}%`
    : "our fee";

  /*
   * The row shows what a passenger can pay with today, not the whole list.
   * "Cash, Mobile money" would be a lie while no gateway is connected.
   */
  const working = (config?.payment_methods ?? []).filter((m) => m.available);
  const workingMethods =
    working.length > 0 ? working.map((m) => m.label).join(", ") : "Cash";

  const filled = (doc: LegalDoc) =>
    fillDoc(doc, {
      fee,
      supportEmail: config?.support_email ?? "support@twogende.ug",
      privacyEmail: config?.privacy_email ?? "privacy@twogende.ug",
    });

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            view === "settings" ? router.back() : setView("settings")
          }
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={18} color={colors.ink} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>{TITLES[view]}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {view === "settings" ? (
          <SettingsList
            available={workingMethods}
            rideUpdates={rideUpdates}
            marketing={marketing}
            onToggle={toggle}
            onOpen={setView}
          />
        ) : null}

        {view === "language" ? <LanguageList /> : null}
        {view === "payment" ? (
          <PaymentMethodList methods={config?.payment_methods ?? []} />
        ) : null}
        {view === "privacy" ? <Doc doc={filled(PRIVACY)} /> : null}
        {view === "terms" ? <Doc doc={filled(TERMS)} /> : null}
        {view === "data" ? <DataSafety /> : null}

        {view === "delete" ? (
          <DeleteAccount
            reason={reason}
            onReason={setReason}
            confirmed={confirmed}
            onConfirm={() => setConfirmed((c) => !c)}
            busy={busy}
            error={error}
            onDelete={() => void confirmDelete()}
            onKeep={() => {
              setConfirmed(false);
              setReason(null);
              setView("settings");
            }}
          />
        ) : null}

        {view === "done" ? (
          <Closed
            phone={user ? formatInternational(user.phone) : ""}
            onDone={() => void signOut()}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- the list ---------- */

/**
 * The settings list.
 *
 * Deliberately holds nothing about who you are. Name, phone, the verification
 * status and the "verify your ID" banner all live on the profile screen, which
 * owns identity; repeating them here was the same fact in two places, drifting
 * apart the moment one was edited.
 *
 * What is left is only what a person switches: notifications, language, where
 * they pay from, the documents, and the way out.
 */
function SettingsList({
  available,
  rideUpdates,
  marketing,
  onToggle,
  onOpen,
}: {
  available: string;
  rideUpdates: boolean;
  marketing: boolean;
  onToggle: (key: "ride_updates" | "marketing", next: boolean) => void;
  onOpen: (view: SettingsView) => void;
}) {
  return (
    <View>
      <Text style={styles.kicker}>Notifications</Text>
      <View style={styles.card}>
        <ToggleRow
          label="Ride updates"
          hint="Bookings, cancellations, driver arriving"
          value={rideUpdates}
          onChange={(next) => onToggle("ride_updates", next)}
        />
        <ToggleRow
          label="Offers from Twogende"
          hint="Occasional news. Off by default."
          value={marketing}
          onChange={(next) => onToggle("marketing", next)}
          ruled
        />
      </View>

      <Text style={styles.kicker}>Preferences</Text>
      <View style={styles.card}>
        <Pressable
          onPress={() => onOpen("language")}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.rowLabel}>Language</Text>
          <Text style={styles.rowValue}>English</Text>
          <ChevronRight size={16} color="rgba(43,32,24,0.35)" strokeWidth={2.4} />
        </Pressable>

        {/*
          A constant list of every way Twogende takes a contribution. It is
          not a setting to pick: the method is chosen per trip on the payment
          screen, because a person pays one driver in cash and the next by
          phone. This is only where you see what exists.
        */}
        <Pressable
          onPress={() => onOpen("payment")}
          style={({ pressed }) => [styles.row, styles.ruled, pressed && styles.rowPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.rowLabel}>Payment methods</Text>
          <Text style={styles.rowValue}>{available}</Text>
          <ChevronRight size={16} color="rgba(43,32,24,0.35)" strokeWidth={2.4} />
        </Pressable>
      </View>

      <Text style={styles.kicker}>Legal &amp; privacy</Text>
      <View style={styles.card}>
        {LEGAL_ROWS.map((row, index) => (
          <Pressable
            key={row.label}
            onPress={() => onOpen(row.view)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.ruled,
              pressed && styles.rowPressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
            <ChevronRight size={16} color="rgba(43,32,24,0.35)" strokeWidth={2.4} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.kicker}>Danger zone</Text>
      <Pressable
        onPress={() => onOpen("delete")}
        style={({ pressed }) => [styles.danger, pressed && styles.rowPressed]}
        accessibilityRole="button"
      >
        <Trash2 size={18} color={colors.terraDark} strokeWidth={2.2} />
        <Text style={styles.dangerLabel}>Delete my account</Text>
      </Pressable>
      <Text style={styles.dangerNote}>
        Deletes your profile, ID documents and selfie. Completed trip records
        are kept for a year before they are completely wiped out, so feel free
        to come back to Twogende before your data is completely deleted.
      </Text>

      <Text style={styles.version}>Twogende 1.0.0 · Kampala, Uganda</Text>
    </View>
  );
}

/** A read-only fact. No chevron, because nothing opens yet. */
function Row({
  label,
  value,
  tone,
  ruled,
}: {
  label: string;
  value: string;
  tone?: "verified" | "muted";
  ruled?: boolean;
}) {
  return (
    <View style={[styles.row, ruled && styles.ruled]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          tone === "verified" && styles.rowValueVerified,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const LEGAL_ROWS: { label: string; view: SettingsView }[] = [
  { label: "Privacy policy", view: "privacy" },
  { label: "Terms of service", view: "terms" },
  { label: "Data safety", view: "data" },
];

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  ruled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  ruled?: boolean;
}) {
  return (
    <View style={[styles.row, ruled && styles.ruled]}>
      <View style={styles.toggleText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "rgba(43,32,24,0.2)", true: colors.acacia }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

/**
 * The languages Twogende will carry, and the ones it does not yet.
 *
 * Only English is translated. The other three are listed because they are the
 * ones that matter on these routes and people should be able to see them
 * coming, but they are marked rather than selectable: a language picker that
 * changes nothing is worse than one that admits it is not ready.
 */
const LANGUAGES = [
  { name: "English", native: "English", ready: true },
  { name: "Kiswahili", native: "Kiswahili", ready: false },
  { name: "Luganda", native: "Oluganda", ready: false },
  { name: "Runyankole", native: "Runyankole", ready: false },
];

function LanguageList() {
  return (
    <View>
      <View style={styles.introCard}>
        <Text style={styles.introKicker}>Language</Text>
        <Text style={styles.introText}>
          Twogende is in English today. Kiswahili, Luganda and Runyankole are
          being translated. Any other language is further off.
        </Text>
      </View>

      <View style={styles.card}>
        {LANGUAGES.map((language, index) => (
          <View
            key={language.name}
            style={[styles.row, index > 0 && styles.ruled]}
          >
            <View style={styles.toggleText}>
              <Text style={styles.rowLabel}>{language.name}</Text>
              {language.native !== language.name ? (
                <Text style={styles.rowHint}>{language.native}</Text>
              ) : null}
            </View>

            {language.ready ? (
              <Check size={18} color={colors.acacia} strokeWidth={2.6} />
            ) : (
              <Text style={styles.rowValue}>Coming soon</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Every way Twogende takes a contribution.
 *
 * Read-only on purpose. The method is chosen per trip on the payment screen,
 * because the same person pays one driver in cash and the next by phone, so a
 * single stored preference would be wrong half the time. This list only says
 * what exists and what works yet.
 */
function PaymentMethodList({ methods }: { methods: PaymentMethodOption[] }) {
  return (
    <View>
      <View style={styles.introCard}>
        <Text style={styles.introKicker}>How you can pay</Text>
        <Text style={styles.introText}>
          You choose how to pay at the end of each trip, on the payment screen.
          Nothing is charged automatically and Twogende never holds your money.
        </Text>
      </View>

      <View style={styles.card}>
        {methods.map((method, index) => (
          <View
            key={method.key}
            style={[styles.row, index > 0 && styles.ruled]}
          >
            <View style={styles.toggleText}>
              <Text style={styles.rowLabel}>{method.label}</Text>
              <Text style={styles.rowHint}>{method.note}</Text>
            </View>

            {method.available ? (
              <Check size={18} color={colors.acacia} strokeWidth={2.6} />
            ) : (
              <Text style={styles.rowValue}>Coming soon</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- documents ---------- */

function Doc({ doc }: { doc: LegalDoc }) {
  return (
    <View>
      <View style={styles.introCard}>
        <Text style={styles.introKicker}>{doc.kicker}</Text>
        <Text style={styles.introText}>{doc.intro}</Text>
      </View>

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          {section.paras.map((para, index) => (
            <Text key={index} style={styles.para}>
              {para}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function DataSafety() {
  return (
    <View>
      <View style={styles.introCard}>
        <Text style={styles.introKicker}>Play Store declaration</Text>
        <Text style={styles.introText}>
          Every category Twogende collects, why, how it is stored, and whether
          it leaves us. This is the same wording filed in the Data safety form.
        </Text>
        <View style={styles.pills}>
          <Pill tone="acacia">Encrypted in transit</Pill>
          <Pill tone="acacia">Deletion on request</Pill>
          <Pill tone="terra">No data sold</Pill>
        </View>
      </View>

      {DATA_CATEGORIES.map((item) => (
        <View key={item.name} style={styles.dataCard}>
          <View style={styles.dataHead}>
            <Text style={styles.dataName}>{item.name}</Text>
            <Pill tone={item.shared ? "terra" : "acacia"}>
              {item.shared ? "Shared" : "Not shared"}
            </Pill>
          </View>
          <View style={styles.dataRule} />
          <Fact k="Purpose" v={item.purpose} />
          <Fact k="Storage" v={item.storage} />
          <Fact k="Kept for" v={item.retention} />
          <Fact k="Required" v={item.required} />
        </View>
      ))}

      <View style={styles.sharedCard}>
        <Text style={styles.sharedHeading}>Shared with third parties</Text>
        <Text style={styles.sharedPara}>
          Phone number and first name are shared with the matched driver or
          passenger once a booking is confirmed - that sharing is the service.
        </Text>
        <Text style={styles.sharedPara}>
          Mobile money transactions pass the payer number and amount to MTN or
          Airtel. Nothing else is shared, sold, or used for advertising.
        </Text>
      </View>
    </View>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factKey}>{k}</Text>
      <Text style={styles.factValue}>{v}</Text>
    </View>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "acacia" | "terra";
  children: string;
}) {
  return (
    <View style={[styles.pill, tone === "terra" ? styles.pillTerra : styles.pillAcacia]}>
      <Text
        style={[
          styles.pillText,
          tone === "terra" ? styles.pillTextTerra : styles.pillTextAcacia,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/* ---------- delete ---------- */

function DeleteAccount({
  reason,
  onReason,
  confirmed,
  onConfirm,
  busy,
  error,
  onDelete,
  onKeep,
}: {
  reason: string | null;
  onReason: (value: string) => void;
  confirmed: boolean;
  onConfirm: () => void;
  busy: boolean;
  error: string | null;
  onDelete: () => void;
  onKeep: () => void;
}) {
  return (
    <View>
      <View style={styles.warnCard}>
        <Text style={styles.warnHeading}>This cannot be undone</Text>
        <Text style={styles.warnPara}>
          Your account is closed immediately and your ID documents and selfie
          are erased within 30 days.
        </Text>
      </View>

      <Text style={styles.kicker}>What happens</Text>
      <View style={styles.card}>
        <View style={styles.factsPad}>
          <DeleteFact tone={colors.terra} icon="cross">
            Your profile, ratings and reviews disappear from Twogende.
          </DeleteFact>
          <DeleteFact tone={colors.terra} icon="cross">
            Any ride you have published is cancelled and passengers are told.
          </DeleteFact>
          <DeleteFact tone={colors.ochre} icon="clock">
            Your ID document and selfie are erased within 30 days.
          </DeleteFact>
          <DeleteFact tone={colors.acacia} icon="check" last>
            Completed trip and payment records are kept 1 year, as tax law
            requires.
          </DeleteFact>
        </View>
      </View>

      <Text style={styles.kicker}>Why are you leaving? (optional)</Text>
      <View style={styles.reasons}>
        {DELETION_REASONS.map((option) => {
          const chosen = reason === option;

          return (
            <Pressable
              key={option}
              onPress={() => onReason(option)}
              style={[styles.reason, chosen && styles.reasonChosen]}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
            >
              <Text style={styles.reasonLabel}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onConfirm}
        style={styles.confirmRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
      >
        <View style={[styles.checkbox, confirmed && styles.checkboxOn]}>
          {confirmed ? <Check size={13} color="#ffffff" strokeWidth={3.4} /> : null}
        </View>
        <Text style={styles.confirmText}>
          I understand my account, ratings and documents will be permanently
          deleted.
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={onDelete}
        disabled={!confirmed || busy}
        accessibilityRole="button"
        style={[styles.deleteButton, (!confirmed || busy) && styles.deleteDisabled]}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.deleteLabel}>Delete my account</Text>
        )}
      </Pressable>

      <Pressable onPress={onKeep} style={styles.keepButton} accessibilityRole="button">
        <Text style={styles.keepLabel}>Keep my account</Text>
      </Pressable>
    </View>
  );
}

function DeleteFact({
  tone,
  icon,
  last,
  children,
}: {
  tone: string;
  icon: "cross" | "clock" | "check";
  last?: boolean;
  children: string;
}) {
  const Icon = icon === "cross" ? X : icon === "clock" ? Clock : Check;

  return (
    <View style={[styles.deleteFact, last && styles.deleteFactLast]}>
      <Icon size={17} color={tone} strokeWidth={2.4} style={styles.deleteFactIcon} />
      <Text style={styles.deleteFactText}>{children}</Text>
    </View>
  );
}

function Closed({ phone, onDone }: { phone: string; onDone: () => void }) {
  return (
    <View style={styles.closed}>
      <View style={styles.closedCheck}>
        <Check size={34} color={colors.acaciaDark} strokeWidth={2.3} />
      </View>
      <Text style={styles.closedTitle}>Account closed</Text>
      <Text style={styles.closedBody}>
        Your documents will be erased within 30 days. A confirmation was sent to{" "}
        {phone}.
      </Text>
      <Pressable onPress={onDone} style={styles.keepButton} accessibilityRole="button">
        <Text style={styles.keepLabel}>Back to start</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 20,
    letterSpacing: -0.2,
    color: colors.ink,
  },

  content: { paddingHorizontal: 18, paddingBottom: 26 },


  kicker: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
    color: colors.terra,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 18,
    marginTop: 10,
    marginBottom: 20,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  ruled: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowPressed: { backgroundColor: "rgba(43,32,24,0.035)" },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.body.bold,
    fontSize: 14.5,
    color: colors.ink,
  },
  rowValue: {
    fontFamily: fonts.body.bold,
    fontSize: 13,
    color: "rgba(43,32,24,0.45)",
  },
  rowValueVerified: { color: colors.acaciaDark },
  rowHint: {
    marginTop: 2,
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    color: inkTints.placeholder,
  },
  toggleText: { flex: 1, minWidth: 0 },

  danger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "rgba(192,81,46,0.35)",
    backgroundColor: "rgba(192,81,46,0.10)",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  dangerLabel: {
    flex: 1,
    fontFamily: fonts.body.extraBold,
    fontSize: 15,
    color: colors.terraDark,
  },
  dangerNote: {
    marginTop: 10,
    marginHorizontal: 4,
    fontFamily: fonts.body.semiBold,
    fontSize: 12.5,
    lineHeight: 19.4,
    color: inkTints.label,
  },
  version: {
    marginTop: 22,
    marginHorizontal: 4,
    fontFamily: fonts.body.bold,
    fontSize: 12,
    color: "rgba(43,32,24,0.4)",
  },


  introCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  introKicker: {
    fontFamily: fonts.body.extraBold,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
    color: colors.terra,
  },
  introText: {
    marginTop: 8,
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    lineHeight: 20.15,
    color: inkTints.meta,
  },

  section: { marginBottom: 20 },
  sectionHeading: {
    fontFamily: fonts.display.bold,
    fontSize: 16.5,
    letterSpacing: -0.165,
    color: colors.ink,
    marginBottom: 8,
  },
  para: {
    marginBottom: 9,
    fontFamily: fonts.body.regular,
    fontSize: 13.5,
    lineHeight: 21.87,
    color: "rgba(43,32,24,0.78)",
  },

  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9 },
  pillAcacia: { backgroundColor: "rgba(108,122,69,0.15)" },
  pillTerra: { backgroundColor: "rgba(192,81,46,0.12)" },
  pillText: { fontFamily: fonts.body.extraBold, fontSize: 11.5 },
  pillTextAcacia: { color: colors.acaciaDark },
  pillTextTerra: { color: colors.terraDark },

  dataCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  dataHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  dataName: {
    flex: 1,
    fontFamily: fonts.display.bold,
    fontSize: 15.5,
    letterSpacing: -0.155,
    color: colors.ink,
  },
  dataRule: { height: 1, backgroundColor: colors.divider, marginVertical: 13 },
  fact: { flexDirection: "row", gap: 12, marginBottom: 8 },
  factKey: {
    width: 74,
    fontFamily: fonts.body.extraBold,
    fontSize: 11.5,
    letterSpacing: 0.575,
    textTransform: "uppercase",
    color: "rgba(43,32,24,0.42)",
    paddingTop: 1,
  },
  factValue: {
    flex: 1,
    fontFamily: fonts.body.regular,
    fontSize: 13.5,
    lineHeight: 20.9,
    color: "rgba(43,32,24,0.8)",
  },

  sharedCard: {
    backgroundColor: "rgba(192,81,46,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(192,81,46,0.28)",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  sharedHeading: {
    fontFamily: fonts.display.bold,
    fontSize: 15.5,
    color: colors.ink,
    marginBottom: 8,
  },
  sharedPara: {
    marginBottom: 9,
    fontFamily: fonts.body.regular,
    fontSize: 13.5,
    lineHeight: 21.6,
    color: "rgba(43,32,24,0.8)",
  },

  warnCard: {
    backgroundColor: "rgba(192,81,46,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(192,81,46,0.30)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  warnHeading: {
    fontFamily: fonts.display.bold,
    fontSize: 17,
    letterSpacing: -0.17,
    color: colors.ink,
    marginBottom: 6,
  },
  warnPara: {
    fontFamily: fonts.body.regular,
    fontSize: 13.5,
    lineHeight: 21.33,
    color: "rgba(43,32,24,0.72)",
  },

  factsPad: { paddingVertical: 16, paddingHorizontal: 18 },
  deleteFact: { flexDirection: "row", gap: 11, marginBottom: 12 },
  deleteFactLast: { marginBottom: 0 },
  deleteFactIcon: { marginTop: 1 },
  deleteFactText: {
    flex: 1,
    fontFamily: fonts.body.regular,
    fontSize: 13.5,
    lineHeight: 20.9,
    color: "rgba(43,32,24,0.8)",
  },

  reasons: { gap: 8, marginTop: 10, marginBottom: 20 },
  reason: {
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  reasonChosen: {
    borderColor: colors.terra,
    backgroundColor: "rgba(192,81,46,0.10)",
  },
  reasonLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 14,
    color: colors.ink,
  },

  confirmRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "rgba(43,32,24,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { borderColor: colors.terra, backgroundColor: colors.terra },
  confirmText: {
    flex: 1,
    fontFamily: fonts.body.semiBold,
    fontSize: 13.5,
    lineHeight: 20.25,
    color: "rgba(43,32,24,0.78)",
  },

  error: {
    marginBottom: 14,
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.terraDark,
    textAlign: "center",
  },

  deleteButton: {
    backgroundColor: colors.terraDark,
    borderRadius: 16,
    padding: 17,
    alignItems: "center",
    marginBottom: 10,
  },
  deleteDisabled: { backgroundColor: "rgba(43,32,24,0.22)" },
  deleteLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15.5,
    color: "#ffffff",
  },
  keepButton: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  keepLabel: {
    fontFamily: fonts.body.extraBold,
    fontSize: 15,
    color: colors.ink,
  },

  closed: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 12 },
  closedCheck: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(108,122,69,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  closedTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 22,
    letterSpacing: -0.22,
    color: colors.ink,
    marginBottom: 8,
  },
  closedBody: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    lineHeight: 22.4,
    color: inkTints.meta,
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 26,
  },
});
