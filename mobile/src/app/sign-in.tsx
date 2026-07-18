import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { signIn } from '@/modules/auth/auth-client';
import { c, panel, serifBold } from '@/ui/theme/theme';

// prefilled with the seed script's demo credentials for a friction-free demo.
export default function SignInScreen() {
  const [email, setEmail] = useState('demo@wearclair.dev');
  const [password, setPassword] = useState('wearclair-demo');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);

    const result = await signIn.email({ email, password });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? 'Could not sign in');

      return;
    }

    // the tabs guard re-fetches + hydrates the session on mount, so a plain navigate
    // is safe — it no longer bounces on a stale null session.
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.brandBlock}>
        <View style={styles.mark}>
          <Text style={styles.markText}>C</Text>
        </View>
        <Text style={styles.brand}>Clair</Text>
        <Text style={styles.tagline}>Continuous hormone intelligence.</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={c.faint}
          style={styles.input}
          value={email}
        />
        <TextInput
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={c.faint}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={pending}
          onPress={submit}
          style={({ pressed }) => [
            styles.button,
            (pressed || pending) && styles.buttonPressed,
          ]}
        >
          {pending ? (
            <ActivityIndicator color="#0E0E10" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: c.bg,
    flex: 1,
    gap: 32,
    justifyContent: 'center',
    padding: 28,
  },
  brandBlock: { alignItems: 'center', gap: 10 },
  mark: {
    alignItems: 'center',
    backgroundColor: c.accentSoft,
    borderRadius: 22,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  markText: { color: c.accent, fontSize: 34, fontWeight: '800' },
  brand: {
    color: c.ink,
    fontFamily: serifBold,
    fontSize: 36,
  },
  tagline: { color: c.muted, fontSize: 15 },
  card: {
    backgroundColor: c.card,
    borderRadius: 22,
    gap: 12,
    padding: 20,
  },
  input: {
    backgroundColor: panel[4],
    borderRadius: 13,
    color: c.ink,
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  error: { color: c.accentDeep, fontSize: 14 },
  button: {
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: 13,
    marginTop: 6,
    paddingVertical: 15,
  },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
});
