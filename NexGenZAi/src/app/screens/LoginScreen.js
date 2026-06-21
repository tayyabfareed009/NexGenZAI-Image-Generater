import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getReadableError } from '../utils/errors';

export default function LoginScreen() {
  const { authLoading, authError, loginWithGoogle } = useAuth();
  const [localError, setLocalError] = useState('');

  async function handleLogin() {
    setLocalError('');

    try {
      await loginWithGoogle();
    } catch (error) {
      setLocalError(getReadableError(error, 'Unable to start Google login.'));
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>AI Image Generator</Text>
        <Text style={styles.subtitle}>Sign in with Google, describe an image, and generate it with AI.</Text>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          disabled={authLoading}
          onPress={handleLogin}
        >
          {authLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Continue with Google</Text>}
        </Pressable>

        {!!(localError || authError) && <Text style={styles.error}>{localError || authError}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  title: {
    color: '#111827',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 10
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  buttonPressed: {
    opacity: 0.86
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18
  }
});
