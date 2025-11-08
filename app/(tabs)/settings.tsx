import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, Platform, ScrollView } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { onAuthChange, signInWithEmailPassword, signOut, signUpWithEmailPassword } from '@/lib/auth';
import NotificationSettingsCard from '@/components/NotificationSettingsCard';
import { JournalTheme } from '@/constants/journalTheme';

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <Text style={styles.cardDescription}>
              Sign in to sync your dreams across devices
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={JournalTheme.textSecondary}
              autoCapitalize="none"
              inputMode="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={JournalTheme.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <View style={styles.row}>
              <Pressable
                style={[styles.btn, styles.primary, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={handleSignIn}
              >
                <Text style={styles.btnText}>Sign In</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.secondary, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={handleSignUp}
              >
                <Text style={styles.btnTextSecondary}>Sign Up</Text>
              </Pressable>
            </View>

            <Text style={styles.hint}>Configure Supabase keys to enable authentication</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <Text style={styles.cardDescription}>You're signed in and syncing</Text>

            <View style={styles.userInfo}>
              <Text style={styles.userLabel}>Email</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>

            <Pressable
              style={[styles.btn, styles.danger, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={handleSignOut}
            >
              <Text style={styles.btnText}>Sign Out</Text>
            </Pressable>
          </View>
        )}

        <NotificationSettingsCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: JournalTheme.backgroundDark,
  },
  header: {
    paddingHorizontal: JournalTheme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: JournalTheme.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: JournalTheme.spacing.md,
  },
  card: {
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.md,
    padding: JournalTheme.spacing.md,
    marginBottom: JournalTheme.spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    marginBottom: JournalTheme.spacing.xs,
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    marginBottom: JournalTheme.spacing.md,
    lineHeight: 20,
  },
  input: {
    backgroundColor: JournalTheme.backgroundSecondary,
    borderRadius: JournalTheme.borderRadius.sm,
    paddingHorizontal: JournalTheme.spacing.md,
    paddingVertical: 12,
    marginBottom: JournalTheme.spacing.sm,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: JournalTheme.spacing.sm,
    marginTop: JournalTheme.spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: JournalTheme.spacing.md,
    borderRadius: JournalTheme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: JournalTheme.accent,
  },
  secondary: {
    backgroundColor: JournalTheme.backgroundSecondary,
  },
  danger: {
    backgroundColor: '#dc2626',
    marginTop: JournalTheme.spacing.md,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: JournalTheme.backgroundCard,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  btnTextSecondary: {
    color: JournalTheme.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    marginTop: JournalTheme.spacing.sm,
    lineHeight: 18,
  },
  userInfo: {
    backgroundColor: JournalTheme.backgroundSecondary,
    borderRadius: JournalTheme.borderRadius.sm,
    padding: JournalTheme.spacing.md,
    marginBottom: JournalTheme.spacing.sm,
  },
  userLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textPrimary,
  },
});
