import { Ionicons } from '@expo/vector-icons'; // Standard in Expo templates
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getReadableError } from '../utils/errors';

export default function LoginScreen() {
  const { authLoading, authError, loginWithEmail, signUpWithEmail, loginWithGoogle } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [securePassword, setSecurePassword] = useState(true); // Eye toggle state
  const [localError, setLocalError] = useState('');

  async function handleAuth() {
    setLocalError('');
    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both your email and password.');
      return;
    }

    try {
      if (isRegistering) {
        await signUpWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (error) {
      const fallbackMsg = isRegistering ? 'Unable to sign up.' : 'Unable to log in.';
      setLocalError(getReadableError(error, fallbackMsg));
    }
  }

  async function handleGoogleLogin() {
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
        
        {/* Header / Branding */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>NexGenZ<Text style={styles.titleAccent}>Ai</Text></Text>
          <Text style={styles.subtitle}>
            {isRegistering ? 'Create an account to unlock your imagination.' : 'Sign in to generate hyper-realistic images with AI.'}
          </Text>
        </View>

        {/* Input Fields */}
        <View style={styles.formContainer}>
          
          {/* Email Input */}
          <View style={[styles.inputWrapper, authLoading && styles.disabledInput]}>
            <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Email Address" 
              placeholderTextColor="#94a3b8"
              value={email} 
              onChangeText={setEmail} 
              autoCapitalize="none" 
              keyboardType="email-address" 
              editable={!authLoading}
            />
          </View>

          {/* Password Input */}
          <View style={[styles.inputWrapper, authLoading && styles.disabledInput]}>
            <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Password" 
              placeholderTextColor="#94a3b8"
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry={securePassword} 
              editable={!authLoading}
            />
            <Pressable 
              onPress={() => setSecurePassword(!securePassword)} 
              style={styles.eyeIcon}
              hitSlop={12}
            >
              <Ionicons 
                name={securePassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#94a3b8" 
              />
            </Pressable>
          </View>

          {/* Main Email/Password Action Button */}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            disabled={authLoading}
            onPress={handleAuth}
          >
            {authLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>{isRegistering ? 'Create Account' : 'Sign In'}</Text>
            )}
          </Pressable>
        </View>

        {/* Professional "OR" Separator Layout */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Authentication Container */}
        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}
          disabled={authLoading}
          onPress={handleGoogleLogin}
        >
          <Ionicons name="logo-google" size={18} color="#2563eb" style={styles.googleIcon} />
          <Text style={styles.googleButtonText}>Google Authentication</Text>
        </Pressable>

        {/* Toggle option link between Sign-In and Sign-Up */}
        <Pressable 
          onPress={() => {
            setIsRegistering(!isRegistering);
            setLocalError('');
          }}
          disabled={authLoading}
          style={styles.switchLink}
        >
          <Text style={styles.switchText}>
            {isRegistering ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </Text>
        </Pressable>

        {/* Error Container Block */}
        {!!(localError || authError) && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={16} color="#b91c1c" />
            <Text style={styles.error}>{localError || authError}</Text>
          </View>
        )}
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
  headerContainer: {
    marginBottom: 32
  },
  title: {
    color: '#0f172a',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8
  },
  titleAccent: {
    color: '#2563eb'
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22
  },
  formContainer: {
    width: '100%'
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    height: 54,
    marginBottom: 16,
    paddingHorizontal: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  disabledInput: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1'
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    height: '100%'
  },
  eyeIcon: {
    padding: 4
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 54,
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3
  },
  buttonPressed: {
    backgroundColor: '#1d4ed8'
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0'
  },
  dividerText: {
    color: '#94a3b8',
    fontSize: 14,
    paddingHorizontal: 12,
    fontWeight: '500'
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    height: 54,
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  googleButtonPressed: {
    backgroundColor: '#f8fafc'
  },
  googleIcon: {
    marginRight: 10
  },
  googleButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '600'
  },
  switchLink: {
    marginTop: 24,
    alignItems: 'center'
  },
  switchText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '600'
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginTop: 24
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    flexShrink: 1
  }
});