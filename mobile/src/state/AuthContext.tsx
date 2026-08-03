import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as authApi from "../api/auth";
import { ApiError } from "../api/client";
import type { Me } from "../types";

const TOKEN_KEY = "twogende.token";

type AuthState = {
  /** Null while the stored token is still being read from the keychain. */
  loading: boolean;
  token: string | null;
  user: Me | null;
  signIn: (token: string, user: Me) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Me | null>(null);

  // On launch, restore the session from the keychain and confirm it's still
  // good. A token revoked from another device should not leave this one
  // sitting on a stale signed-in shell.
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!stored) return;

        const { data } = await authApi.me(stored);
        setToken(stored);
        setUser(data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
        // Network failures leave the token alone being offline is not the
        // same as being signed out.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (newToken: string, newUser: Me) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const signOut = useCallback(async () => {
    const current = token;
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);

    // Best effort: the local session is already gone either way.
    if (current) {
      try {
        await authApi.logout(current);
      } catch {
        /* ignore */
      }
    }
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const { data } = await authApi.me(token);
    setUser(data);
  }, [token]);

  const value = useMemo(
    () => ({ loading, token, user, signIn, signOut, refreshUser }),
    [loading, token, user, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}

/**
 * For screens that only run behind the signed-in guard, where the token is
 * known to exist.
 */
export function useToken(): string {
  const { token } = useAuth();
  if (!token)
    throw new Error("useToken called outside the authenticated stack.");
  return token;
}
