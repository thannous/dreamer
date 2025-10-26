import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { onAuthChange, signInWithEmailPassword, signOut, signUpWithEmailPassword } from '@/lib/auth';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';

export default function SettingsScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onAuthChange(setUser);
  }, []);

  const handleSignUp = async () => {
    if (!email || !password) return;
    setBusy(true);
    try {
      await signUpWithEmailPassword(email.trim(), password);
      Alert.alert('Check your email', 'Confirm your account if required.');
      setPassword('');
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) return;
    setBusy(true);
    try {
      await signInWithEmailPassword(email.trim(), password);
      setPassword('');
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch (e: any) {
      Alert.alert('Sign out failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {!user ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <TextInput
            style={styles.input}
            placeholder="email"
            autoCapitalize="none"
            inputMode="email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.primary]} disabled={busy} onPress={handleSignIn}>
              <Text style={styles.btnText}>Sign In</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.ghost]} disabled={busy} onPress={handleSignUp}>
              <Text style={[styles.btnText, styles.ghostText]}>Sign Up</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>Configure Supabase keys to enable auth.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signed in</Text>
          <Text style={styles.muted}>{user.email}</Text>
          <Pressable style={[styles.btn, styles.danger]} disabled={busy} onPress={handleSignOut}>
            <Text style={styles.btnText}>Sign Out</Text>
          </Pressable>
        </View>
      )}

      <NotificationSettingsCard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  card: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#2563eb' },
  danger: { backgroundColor: '#ef4444', marginTop: 8 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ddd' },
  btnText: { color: '#fff', fontWeight: '700' },
  ghostText: { color: '#111' },
  muted: { color: '#666', marginTop: 8 },
});
