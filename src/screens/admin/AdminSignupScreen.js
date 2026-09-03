import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme/theme';

export default function AdminSignupScreen({ navigation }) {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignup = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    try {
      await signup(email.trim(), password);
      navigation.replace('AdminTabs');
    } catch (err) {
      setError(err.message || 'Impossible de créer le compte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>Premier administrateur</Text>
          <Text style={styles.subtitle}>
            Cette création de compte n'est possible que si aucun administrateur n'existe encore.
          </Text>

          <Card style={{ marginTop: spacing.lg }}>
            <InputField
              label="Adresse e-mail"
              placeholder="admin@entreprise.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <InputField
              label="Mot de passe"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <InputField
              label="Confirmer le mot de passe"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton
              label="Créer le compte"
              icon="person-add-outline"
              onPress={handleSignup}
              loading={loading}
              disabled={!email.trim() || !password || !confirmPassword}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  backButton: {
    width: 40,
    height: 40,
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.h1, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  error: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
});
