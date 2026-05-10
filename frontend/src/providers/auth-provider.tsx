"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { getFirebaseAuth, isDevBypassEnabled } from "@/lib/firebase";

/**
 * Minimal authenticated user surface used by the rest of the app.
 * We don't expose the raw FirebaseUser to keep dev-bypass parity easy.
 */
export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Returns a token suitable for the Authorization header. In dev-bypass mode
   * returns the sentinel "dev-bypass-token" — the API client recognizes the
   * dev-bypass flag and sends X-Dev-Bypass-Uid instead.
   */
  getIdToken: () => Promise<string | null>;
};

const DEV_BYPASS_TOKEN = "dev-bypass-token";

const AuthContext = createContext<AuthContextValue | null>(null);

function devBypassUser(): AuthUser {
  return {
    uid: process.env.NEXT_PUBLIC_DEV_BYPASS_UID ?? "dev-user",
    displayName: process.env.NEXT_PUBLIC_DEV_BYPASS_NAME ?? "Dev User",
    email: process.env.NEXT_PUBLIC_DEV_BYPASS_EMAIL ?? "dev@orion.local",
    photoURL: null,
  };
}

function toAuthUser(fbUser: FirebaseUser): AuthUser {
  return {
    uid: fbUser.uid,
    displayName: fbUser.displayName,
    email: fbUser.email,
    photoURL: fbUser.photoURL,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initial state:
  // - Dev-bypass: synthesize the user up-front so there's no flicker and no
  //   loading state at all.
  // - Firebase available: start with null + loading=true; onAuthStateChanged
  //   drives the transition.
  // - Firebase NOT initialized (missing env): start with null + loading=false
  //   so the AppShell immediately redirects to /login instead of spinning.
  const [user, setUser] = useState<AuthUser | null>(() =>
    isDevBypassEnabled ? devBypassUser() : null,
  );
  const [loading, setLoading] = useState<boolean>(() => {
    if (isDevBypassEnabled) return false;
    if (typeof window === "undefined") return true;
    return getFirebaseAuth() !== null;
  });

  useEffect(() => {
    if (isDevBypassEnabled) return; // Lazy initial state covers it.
    const auth = getFirebaseAuth();
    if (!auth) return; // Lazy initial state already set loading=false.
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? toAuthUser(fbUser) : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (isDevBypassEnabled) return;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase not initialized");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (isDevBypassEnabled) return;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase not initialized");
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    if (isDevBypassEnabled) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (isDevBypassEnabled) return DEV_BYPASS_TOKEN;
    const auth = getFirebaseAuth();
    const fbUser = auth?.currentUser;
    if (!fbUser) return null;
    return fbUser.getIdToken();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signInWithEmail, signInWithGoogle, signOut, getIdToken }),
    [user, loading, signInWithEmail, signInWithGoogle, signOut, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
