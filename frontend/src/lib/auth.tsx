"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@shared/types";
import { api, setUnauthorisedHandler } from "./api";

type AuthState = {
  user: SessionUser | null;
  ready: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  // Session expired mid-use: drop to the sign-in page.
  useEffect(() => {
    setUnauthorisedHandler(() => {
      setUser(null);
      router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    if (!user && path !== "/login") router.replace("/login");
    if (user && path === "/login") router.replace("/");
  }, [ready, user, path, router]);

  const signIn = useCallback(async (username: string, password: string) => {
    const r = await api.login(username, password);
    setUser(r.user);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
    router.replace("/login");
  }, [router]);

  return <AuthContext.Provider value={{ user, ready, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
