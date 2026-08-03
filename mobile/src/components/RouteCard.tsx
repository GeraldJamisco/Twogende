import { LocateFixed, MapPin, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  autocomplete,
  newSessionToken,
  placeDetails,
  type Place,
  type PlaceSuggestion,
} from "../api/places";
import { resolveCurrentPlace } from "../lib/currentLocation";
import { useAuth } from "../state/AuthContext";
import { colors, fonts, inkTints } from "../theme";

type Props = {
  origin: Place | null;
  destination: Place | null;
  onOriginChange: (place: Place | null) => void;
  onDestinationChange: (place: Place | null) => void;
  /**
   * Search draws the origin as a map pin; Offer a ride draws it as a hollow
   * ring. Same card, different mark.
   */
  originMark?: "pin" | "ring";
};

type ActiveField = "origin" | "destination" | null;

/**
 * The two-row route card from "Twogende Search.dc.html".
 *
 * The design draws plain text inputs, but a typed place name can't be matched
 * against a trip — two people writing "Ntinda" have to resolve to the same
 * Google place. So typing here searches, and the value that leaves is always
 * something picked from the list.
 */
export function RouteCard({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  originMark = "pin",
}: Props) {
  const { token } = useAuth();

  const [active, setActive] = useState<ActiveField>(null);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const session = useRef(newSessionToken());

  // Debounced: one request per pause in typing, not per keystroke.
  useEffect(() => {
    if (!active || text.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      if (!token) return;
      setSearching(true);
      setMessage(null);

      try {
        const result = await autocomplete(token, text.trim(), session.current);
        setSuggestions(result.data);
        if (result.data.length === 0) setMessage("No matching places.");
      } catch {
        setMessage("Could not reach place search.");
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [text, token, active]);

  async function choose(suggestion: PlaceSuggestion) {
    if (!token || !active) return;
    setSuggestions([]);
    setSearching(true);

    try {
      const { data } = await placeDetails(token, suggestion.place_id, session.current);
      if (active === "origin") onOriginChange(data);
      else onDestinationChange(data);

      setText("");
      setActive(null);
      // The session closes with the details call.
      session.current = newSessionToken();
    } catch {
      setMessage("Could not load that place.");
    } finally {
      setSearching(false);
    }
  }

  function openField(field: ActiveField) {
    setActive(field);
    setText("");
    setSuggestions([]);
    setMessage(null);
  }

  /**
   * "My current location", which the design shows as the default origin.
   *
   * Permission is asked for on the tap rather than when the screen opens —
   * a prompt nobody triggered is a prompt people refuse.
   */
  async function useCurrentLocation() {
    if (!token || !active) return;

    setLocating(true);
    setMessage(null);

    const outcome = await resolveCurrentPlace(token);

    setLocating(false);

    if (outcome.status === "denied") {
      setMessage("Location is off. Enable it in Settings, or search for a place.");
      return;
    }

    if (outcome.status === "unavailable") {
      setMessage(outcome.message);
      return;
    }

    if (active === "origin") onOriginChange(outcome.place);
    else onDestinationChange(outcome.place);

    setText("");
    setActive(null);
  }

  function renderRow(
    field: Exclude<ActiveField, null>,
    place: Place | null,
    placeholder: string,
    icon: React.ReactNode,
    isLast: boolean,
  ) {
    const editing = active === field;

    return (
      <View style={[styles.row, !isLast && styles.rowDivided, editing && styles.rowActive]}>
        {icon}

        {editing ? (
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={inkTints.inputPlaceholder}
            style={styles.input}
            autoCorrect={false}
            onBlur={() => {
              if (!text) setActive(null);
            }}
          />
        ) : (
          <Pressable
            onPress={() => openField(field)}
            accessibilityRole="button"
            accessibilityLabel={place ? `${placeholder}: ${place.name}` : placeholder}
            style={styles.value}
          >
            <Text
              style={[styles.valueText, !place && styles.valuePlaceholder]}
              numberOfLines={1}
            >
              {place?.name ?? placeholder}
            </Text>
          </Pressable>
        )}

        {place && !editing ? (
          <Pressable
            onPress={() =>
              field === "origin" ? onOriginChange(null) : onDestinationChange(null)
            }
            accessibilityRole="button"
            accessibilityLabel={`Clear ${placeholder}`}
            hitSlop={8}
          >
            <X size={15} color={inkTints.inputPlaceholder} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.card}>
        {renderRow(
          "origin",
          origin,
          "Leaving from",
          originMark === "ring" ? (
            <View style={styles.originRing} />
          ) : (
            <MapPin size={16} color={colors.acacia} strokeWidth={2.2} />
          ),
          false,
        )}
        {renderRow(
          "destination",
          destination,
          "Where to?",
          <View style={styles.destinationMark} />,
          true,
        )}
      </View>

      {searching ? <ActivityIndicator style={styles.spinner} color={colors.terra} /> : null}

      {/*
        Offered while a field is open and empty — the design's default origin
        was "My current location", and this is how you get there.
      */}
      {active && text.trim().length < 2 ? (
        <Pressable
          onPress={useCurrentLocation}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          style={({ pressed }) => [styles.currentLocation, pressed && styles.suggestionPressed]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.terra} />
          ) : (
            <LocateFixed size={17} color={colors.terra} strokeWidth={2.2} />
          )}
          <Text style={styles.currentLocationLabel}>
            {locating ? "Finding you…" : "Use my current location"}
          </Text>
        </Pressable>
      ) : null}

      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.place_id}
              onPress={() => choose(suggestion)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
            >
              <MapPin size={16} color={inkTints.inputPlaceholder} strokeWidth={2} />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionPrimary} numberOfLines={1}>
                  {suggestion.primary_text}
                </Text>
                {suggestion.secondary_text ? (
                  <Text style={styles.suggestionSecondary} numberOfLines={1}>
                    {suggestion.secondary_text}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : message && active ? (
        <Text style={styles.message}>{message}</Text>
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
    padding: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 14,
    borderRadius: 12,
  },
  rowDivided: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowActive: { borderColor: colors.terra },

  destinationMark: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: colors.terra,
  },
  originRing: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: colors.acacia,
  },

  value: { flex: 1 },
  valueText: {
    fontFamily: fonts.body.bold,
    fontSize: 16,
    color: colors.ink,
    textAlign: "center",
  },
  valuePlaceholder: { color: inkTints.inputPlaceholder },

  input: {
    flex: 1,
    fontFamily: fonts.body.bold,
    fontSize: 16,
    color: colors.ink,
    textAlign: "center",
    padding: 0,
  },

  spinner: { marginTop: 10, alignSelf: "center" },

  currentLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  currentLocationLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 14.5,
    color: colors.terraDark,
  },

  suggestions: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  suggestionPressed: { backgroundColor: colors.cream },
  suggestionText: { flex: 1 },
  suggestionPrimary: {
    fontFamily: fonts.body.semiBold,
    fontSize: 14.5,
    color: colors.ink,
  },
  suggestionSecondary: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: inkTints.meta,
  },
  message: {
    marginTop: 8,
    fontFamily: fonts.body.medium,
    fontSize: 12.5,
    color: inkTints.placeholder,
  },
});
