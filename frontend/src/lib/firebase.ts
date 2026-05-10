import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase web SDK init.
 *
 * In dev-bypass mode (NEXT_PUBLIC_DEV_BYPASS_AUTH === "true") we skip
 * initialization entirely so contributors can run the app without a real
 * Firebase project. The auth provider then synthesizes a stub user.
 */

export const isDevBypassEnabled = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function ensureApp(): FirebaseApp | null {
  if (isDevBypassEnabled) return null;
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.apiKey) {
    // Missing config in non-dev-bypass mode — surface a clear error in the
    // browser console rather than crashing on first auth call.
    console.error(
      "[Orion] Firebase env vars missing. Set NEXT_PUBLIC_FIREBASE_* or enable NEXT_PUBLIC_DEV_BYPASS_AUTH=true.",
    );
    return null;
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseApp(): FirebaseApp | null {
  return ensureApp();
}

export function getFirebaseAuth(): Auth | null {
  if (isDevBypassEnabled) return null;
  if (auth) return auth;
  const a = ensureApp();
  if (!a) return null;
  auth = getAuth(a);
  return auth;
}
