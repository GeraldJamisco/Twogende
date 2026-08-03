import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../src/state/AuthContext';
import { colors } from '../src/theme';

/**
 * Entry gate. Sends you to the signed-in tabs or to sign-up, once the stored
 * token has been checked against the API.
 */
export default function Index() {
  const { loading, token } = useAuth();

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.terra} />
      </View>
    );
  }

  return <Redirect href={token ? '/(tabs)' : '/(auth)/welcome'} />;
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
