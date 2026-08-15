import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme/theme';

export default function AdminLoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigation.replace('AdminTabs');
    } catch (err) {
      setError(err.message || 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>Espace administrateur</Text>
          <Text style={styles.subtitle}>Connectez-vous pour gérer les employés et suivre les présences.</Text>

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
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton
              label="Se connecter"
              icon="log-in-outline"
              onPress={handleLogin}
              loading={loading}
              disabled={!email.trim() || !password}
            />
          </Card>

          <TouchableOpacity
            style={styles.signupLink}
            onPress={() => navigation.navigate('AdminSignup')}
          >
            <Text style={styles.signupLinkText}>Aucun administrateur ? Créer le premier compte</Text>
          </TouchableOpacity>
        </View>
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
  content: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.h1, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  error: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
  signupLink: { marginTop: spacing.lg, alignItems: 'center' },
  signupLinkText: { ...typography.caption, color: colors.textSecondary, textDecorationLine: 'underline' },
});
