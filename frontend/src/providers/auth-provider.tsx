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
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { resolveDevBypassUid } from "@/lib/dev-bypass";
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
  signInWithApple: () => Promise<void>;
  /**
   * Passwordless "magic link": email a one-time sign-in link. `continueUrl` is
   * where Firebase returns the user (must be a Firebase-authorized domain); the
   * login page finishes the sign-in on return. No-op under dev-bypass.
   */
  sendSignInLink: (email: string, continueUrl: string) => Promise<void>;
  /** True when `href` is a Firebase email sign-in link. */
  isEmailSignInLink: (href: string) => boolean;
  /** Finish a magic-link sign-in for `email` using the link in `href`. */
  completeEmailLink: (email: string, href: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Returns a token suitable for the Authorization header. In dev-bypass mode
   * returns the sentinel "dev-bypass-token" — the API client recognizes the
   * dev-bypass flag and sends X-Dev-Bypass-Uid instead.
   */
  getIdToken: () => Promise<string | null>;
};

const DEV_BYPASS_TOKEN = "dev-bypass-token";

/**
 * localStorage key holding the address between requesting a magic link and
 * completing it. Firebase needs the original email to finish the sign-in when
 * the user returns via the link, so we stash it here. Exported so the login
 * page can recover it on return.
 */
export const EMAIL_FOR_SIGN_IN_KEY = "orion:emailForSignIn";

const AuthContext = createContext<AuthContextValue | null>(null);

function devBypassUser(): AuthUser {
  return {
    uid: resolveDevBypassUid() ?? "dev-user",
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

  const signInWithApple = useCallback(async () => {
    if (isDevBypassEnabled) return;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase not initialized");
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    await signInWithPopup(auth, provider);
  }, []);

  const sendSignInLink = useCallback(async (email: string, continueUrl: string) => {
    if (isDevBypassEnabled) return;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase not initialized");
    await sendSignInLinkToEmail(auth, email, { url: continueUrl, handleCodeInApp: true });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
    }
  }, []);

  const isEmailSignInLink = useCallback((href: string): boolean => {
    if (isDevBypassEnabled) return false;
    const auth = getFirebaseAuth();
    if (!auth) return false;
    return isSignInWithEmailLink(auth, href);
  }, []);

  const completeEmailLink = useCallback(async (email: string, href: string) => {
    if (isDevBypassEnabled) return;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase not initialized");
    await signInWithEmailLink(auth, email, href);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    }
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
    () => ({
      user,
      loading,
      signInWithEmail,
      signInWithGoogle,
      signInWithApple,
      sendSignInLink,
      isEmailSignInLink,
      completeEmailLink,
      signOut,
      getIdToken,
    }),
    [
      user,
      loading,
      signInWithEmail,
      signInWithGoogle,
      signInWithApple,
      sendSignInLink,
      isEmailSignInLink,
      completeEmailLink,
      signOut,
      getIdToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
