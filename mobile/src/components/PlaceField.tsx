import { MapPin, X } from "../icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  autocomplete,
  newSessionToken,
  placeDetails,
  type Place,
  type PlaceSuggestion,
} from "../api/places";
import { useAuth } from "../state/AuthContext";
import { colors, fonts, inkTints } from "../theme";
import { TextField } from "./ui/TextField";

type Props = {
  label: string;
  placeholder?: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
};

/**
 * Free typing, but the value that leaves this component is always a place the
 * user picked from Google's list so two people choosing "Ntinda" produce the
 * same place_id and their trips actually match.
 */
export function PlaceField({ label, placeholder, value, onChange }: Props) {
  const { token } = useAuth();

  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const session = useRef(newSessionToken());

  // Debounced: one request per pause in typing, not per keystroke.
  useEffect(() => {
    if (value || text.trim().length < 2) {
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
        if (result.data.length === 0) {
          setMessage("No matching places.");
        }
      } catch {
        setMessage("Could not reach place search.");
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [text, token, value]);

  async function choose(suggestion: PlaceSuggestion) {
    if (!token) return;
    setSuggestions([]);
    setSearching(true);

    try {
      const result = await placeDetails(
        token,
        suggestion.place_id,
        session.current,
      );
      onChange(result.data);
      setText("");
      // The session closes with the details call; the next search starts a new one.
      session.current = newSessionToken();
    } catch {
      setMessage("Could not load that place.");
    } finally {
      setSearching(false);
    }
  }

  if (value) {
    return (
      <View style={styles.chosenWrap}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          style={styles.chosen}
          onPress={() => onChange(null)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value.name}. Tap to change.`}
        >
          <MapPin size={17} color={colors.acacia} strokeWidth={2} />
          <View style={styles.chosenText}>
            <Text style={styles.chosenName} numberOfLines={1}>
              {value.name}
            </Text>
            <Text style={styles.chosenAddress} numberOfLines={1}>
              {value.address}
            </Text>
          </View>
          <X size={16} color={inkTints.placeholder} strokeWidth={2} />
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <TextField
        label={label}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        autoCorrect={false}
      />

      {searching ? (
        <ActivityIndicator style={styles.spinner} color={colors.terra} />
      ) : null}

      {suggestions.length > 0 ? (
        <View style={styles.list}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.place_id}
              onPress={() => choose(suggestion)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.suggestion,
                pressed && styles.suggestionPressed,
              ]}
            >
              <MapPin size={16} color={inkTints.placeholder} strokeWidth={2} />
              <View style={styles.chosenText}>
                <Text style={styles.primary} numberOfLines={1}>
                  {suggestion.primary_text}
                </Text>
                {suggestion.secondary_text ? (
                  <Text style={styles.secondary} numberOfLines={1}>
                    {suggestion.secondary_text}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.body.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: inkTints.meta,
    marginBottom: 6,
  },
  chosenWrap: { gap: 0 },
  chosen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.acacia,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  chosenText: { flex: 1 },
  chosenName: { fontFamily: fonts.body.bold, fontSize: 15, color: colors.ink },
  chosenAddress: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: inkTints.meta,
  },
  spinner: { marginTop: 10, alignSelf: "flex-start" },
  list: {
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
  primary: {
    fontFamily: fonts.body.semiBold,
    fontSize: 14.5,
    color: colors.ink,
  },
  secondary: {
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
