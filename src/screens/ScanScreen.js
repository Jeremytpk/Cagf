import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CameraCapture from '../components/CameraCapture';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import { identifyEmployee, reportScanFailure } from '../services/api';
import { colors, radius, spacing, typography } from '../theme/theme';

const RESULT_DISPLAY_MS = 2600;
const REPORT_EVERY = 3;

export default function ScanScreen({ navigation }) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | scanning | success | error
  const [message, setMessage] = useState(null);
  const [failureCount, setFailureCount] = useState(0);

  const resetToIdle = () => {
    setCameraOpen(false);
    setStatus('idle');
    setMessage(null);
    setFailureCount(0);
  };

  const handleRetry = () => {
    setStatus('idle');
    setMessage(null);
  };

  const handleSuccess = (result) => {
    console.log('[ScanScreen] identifyEmployee succeeded:', result);
    const time = result.timestamp
      ? new Date(result.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setStatus('success');
    setMessage(
      result.action === 'in'
        ? `Merci, ${result.name} ! Entrée enregistrée à ${time}.`
        : `Merci, ${result.name} ! Sortie enregistrée à ${time}.`
    );
    setFailureCount(0);
    setTimeout(resetToIdle, RESULT_DISPLAY_MS);
  };

  const handleFailure = (msg, photoBase64, similarity, reason) => {
    console.warn('[ScanScreen] scan failed:', msg, { reason, similarity });
    setStatus('error');
    const next = failureCount + 1;
    setFailureCount(next);

    if (next % REPORT_EVERY === 0) {
      reportScanFailure({ photoBase64: photoBase64 || null, attempts: next, similarity }).catch((reportError) => {
        console.error('[ScanScreen] reportScanFailure failed:', reportError);
      });
      setMessage(`${msg} Un signalement a été envoyé à l'administrateur après ${next} échecs consécutifs.`);
    } else {
      setMessage(msg);
    }
  };

  const handleCapture = async (base64, captureError) => {
    if (captureError || !base64) {
      handleFailure('Échec de la capture. Veuillez réessayer.', base64, null, captureError);
      return;
    }

    setStatus('scanning');
    setMessage(null);
    try {
      const result = await identifyEmployee({ photoBase64: base64 });
      if (result.success) {
        handleSuccess(result);
      } else {
        handleFailure(
          result.message || 'Visage non reconnu. Veuillez réessayer.',
          base64,
          result.similarity,
          'no_match'
        );
      }
    } catch (error) {
      console.error('[ScanScreen] identifyEmployee request failed:', error);
      handleFailure(error.message || 'Une erreur est survenue.', base64, null, error);
    }
  };

  if (cameraOpen) {
    return (
      <View style={styles.cameraRoot}>
        <CameraCapture
          style={styles.camera}
          status={status}
          hint={
            status === 'scanning'
              ? 'Analyse en cours…'
              : status === 'success'
              ? 'Reconnu !'
              : status === 'error'
              ? 'Non reconnu'
              : 'Centrez votre visage dans le carré'
          }
          onCapture={status === 'idle' ? handleCapture : undefined}
          onCancel={resetToIdle}
          showFacingToggle={false}
        />
        {message ? (
          <View style={[styles.resultBanner, status === 'success' ? styles.successBanner : styles.errorBanner]}>
            <View style={styles.resultHeader}>
              <Ionicons
                name={status === 'success' ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={colors.white}
              />
              <Text style={styles.resultText}>{message}</Text>
            </View>
            {status === 'error' ? (
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.resultButton} onPress={handleRetry}>
                  <Text style={styles.resultButtonText}>Réessayer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.resultButton, styles.resultButtonOutline]}
                  onPress={resetToIdle}
                >
                  <Text style={[styles.resultButtonText, styles.resultButtonOutlineText]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>CAGF</Text>
          <Text style={styles.brandSubtitle}>Pointage intelligent</Text>
        </View>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('AdminLogin')}
          accessibilityLabel="Connexion administrateur"
        >
          <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="scan-circle-outline" size={72} color={colors.primary} />
        </View>
        <Text style={styles.title}>Bonjour !</Text>
        <Text style={styles.subtitle}>
          Scannez votre visage pour pointer votre entrée ou votre sortie. Aucun identifiant n'est nécessaire.
        </Text>

        <Card style={styles.card}>
          <PrimaryButton label="Scanner mon visage" icon="scan-outline" onPress={() => setCameraOpen(true)} />
        </Card>
      </View>

      <Text style={styles.footer}>Un système développé par Jerttech</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  brand: { ...typography.h1, color: colors.primary },
  brandSubtitle: { ...typography.caption },
  loginButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  content: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  heroIconWrap: { alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.h1, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  card: { marginTop: spacing.sm },
  footer: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
    paddingBottom: spacing.md,
  },
  cameraRoot: { flex: 1, backgroundColor: '#000', paddingTop: (RNStatusBar.currentHeight || 0) },
  camera: { flex: 1, borderRadius: 0 },
  resultBanner: {
    position: 'absolute',
    bottom: 140,
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  successBanner: { backgroundColor: colors.accent },
  errorBanner: { backgroundColor: colors.danger },
  resultHeader: { flexDirection: 'row', alignItems: 'center' },
  resultText: { color: colors.white, fontWeight: '600', marginLeft: spacing.sm, flex: 1 },
  resultActions: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  resultButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  resultButtonText: { color: colors.textPrimary, fontWeight: '700' },
  resultButtonOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.white },
  resultButtonOutlineText: { color: colors.white },
});
