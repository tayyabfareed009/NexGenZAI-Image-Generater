import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../../config/firebase';
import { registerAuthTokenGetter } from '../api/client';
import { syncGoogleUser } from '../api/auth';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [mongoUser, setMongoUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true
  });

  async function getFirebaseIdToken(forceRefresh = false) {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to continue.');
    }

    return auth.currentUser.getIdToken(forceRefresh);
  }

  useEffect(() => {
    registerAuthTokenGetter(() => getFirebaseIdToken(true));
  }, []);

  async function syncUserWithBackend() {
    const user = await syncGoogleUser();
    setMongoUser(user);
    return user;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      try {
        if (user) {
          await syncUserWithBackend();
        } else {
          setMongoUser(null);
        }
      } catch (error) {
        setAuthError(error.message || 'Unable to sync your profile with the backend.');
      } finally {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    async function completeGoogleLogin() {
      if (response?.type !== 'success') {
        return;
      }

      const idToken = response.authentication?.idToken || response.params?.id_token;
      const accessToken = response.authentication?.accessToken || response.params?.access_token;

      if (!idToken && !accessToken) {
        throw new Error('Google did not return an ID token or access token. Check OAuth client configuration.');
      }

      setAuthLoading(true);
      setAuthError('');

      try {
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const result = await signInWithCredential(auth, credential);
        await syncUserWithBackend();
      } finally {
        setAuthLoading(false);
      }
    }

    completeGoogleLogin().catch((error) => {
      setAuthLoading(false);
      setAuthError(error.message || 'Google login failed.');
    });
  }, [response]);

  async function loginWithGoogle() {
    if (!request) {
      throw new Error('Google login is not ready yet. Please try again in a moment.');
    }

    setAuthError('');
    await promptAsync();
  }

  async function logout() {
    setAuthLoading(true);
    try {
      await signOut(auth);
      setMongoUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  const value = useMemo(
    () => ({
      firebaseUser,
      mongoUser,
      initializing,
      authLoading,
      authError,
      loginWithGoogle,
      logout,
      getFirebaseIdToken
    }),
    [firebaseUser, mongoUser, initializing, authLoading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
