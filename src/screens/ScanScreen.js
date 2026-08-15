import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar as RNStatusBar,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CameraCapture from '../components/CameraCapture';
import CodeKeypad from '../components/CodeKeypad';
import Card from '../components/Card';
import { verifyEmployeeCode, verifyEmployeeFace } from '../services/api';
import { colors, radius, spacing, typography } from '../theme/theme';

const RESULT_DISPLAY_MS = 2600;
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;
const LOCKOUT_MS = 30000;

export default function ScanScreen({ navigation }) {
  const [stage, setStage] = useState('code'); // code | face
  const [code, setCode] = useState('');
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [codeFailCount, setCodeFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  const [status, setStatus] = useState('idle'); // idle | scanning | success | error
  const [message, setMessage] = useState(null);

  const lockTimerRef = useRef(null);

  useEffect(() => {
    if (!lockedUntil) return undefined;
    lockTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(lockTimerRef.current);
        setLockedUntil(null);
        setCodeFailCount(0);
      }
    }, 500);
    return () => clearInterval(lockTimerRef.current);
  }, [lockedUntil]);

  const resetToIdle = () => {
    setStage('code');
    setCode('');
    setCodeError(null);
    setEmployee(null);
    setStatus('idle');
    setMessage(null);
  };

  const handleCodeChange = (nextCode) => {
    setCodeError(null);
    setCode(nextCode);
  };

  useEffect(() => {
    if (code.length !== CODE_LENGTH || codeVerifying || lockedUntil) return;

    let cancelled = false;
    setCodeVerifying(true);
    verifyEmployeeCode({ code })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          // Différé après la fin des interactions en cours : monter la vue
          // caméra (native, coûteuse) directement dans la continuation d'une
          // promesse réseau plutôt que dans un handler de geste synchrone
          // peut geler le pont JS/natif sur iOS. runAfterInteractions laisse
          // le thread JS se stabiliser avant ce montage.
          InteractionManager.runAfterInteractions(() => {
            setEmployee({ employeeId: result.employeeId, name: result.name });
            setStage('face');
            setCode('');
          });
        } else {
          const next = codeFailCount + 1;
          setCodeFailCount(next);
          setCode('');
          if (next >= MAX_CODE_ATTEMPTS) {
            setLockedUntil(Date.now() + LOCKOUT_MS);
            setCodeError(`Trop de tentatives. Réessayez dans ${Math.ceil(LOCKOUT_MS / 1000)}s.`);
          } else {
            setCodeError(result.message || 'Code invalide.');
          }
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setCode('');
        setCodeError(error.message || 'Une erreur est survenue.');
      })
      .finally(() => {
        if (!cancelled) setCodeVerifying(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleFaceSuccess = (result) => {
    const time = result.timestamp
      ? new Date(result.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setStatus('success');
    setMessage(
      result.action === 'in'
        ? `Merci, ${result.name} ! Entrée enregistrée à ${time}.`
        : `Merci, ${result.name} ! Sortie enregistrée à ${time}.`
    );
    setTimeout(resetToIdle, RESULT_DISPLAY_MS);
  };

  const handleFaceFailure = (msg) => {
    setStatus('error');
    setMessage(msg);
  };

  const handleCapture = async (base64, captureError) => {
    if (captureError || !base64) {
      handleFaceFailure('Échec de la capture. Veuillez réessayer.');
      return;
    }

    setStatus('scanning');
    setMessage(null);
    try {
      const result = await verifyEmployeeFace({ employeeId: employee.employeeId, photoBase64: base64 });
      if (result.success) {
        handleFaceSuccess(result);
      } else {
        handleFaceFailure(result.message || 'Visage non reconnu. Veuillez réessayer.');
      }
    } catch (error) {
      handleFaceFailure(error.message || 'Une erreur est survenue.');
    }
  };

  if (stage === 'face') {
    return (
      <View style={styles.cameraRoot}>
        <CameraCapture
          style={styles.camera}
          status={status}
          resizeWidth={360}
          compressQuality={0.6}
          hint={
            status === 'scanning'
              ? 'Analyse en cours…'
              : status === 'success'
              ? 'Reconnu !'
              : status === 'error'
              ? 'Non reconnu'
              : `Bonjour ${employee?.name || ''}, centrez votre visage`
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
                size={status === 'success' ? 30 : 22}
                color={colors.white}
              />
              <Text style={[styles.resultText, status === 'success' && styles.resultTextSuccess]}>{message}</Text>
            </View>
            {status === 'error' ? (
              <View style={styles.resultActions}>
                <TouchableOpacity
                  style={styles.resultButton}
                  onPress={() => {
                    setStatus('idle');
                    setMessage(null);
                  }}
                >
                  <Text style={styles.resultButtonText}>Réessayer la photo</Text>
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
          <Ionicons name="keypad-outline" size={64} color={colors.primary} />
        </View>
        <Text style={styles.title}>Bonjour !</Text>
        <Text style={styles.subtitle}>
          Entrez votre code secret à {CODE_LENGTH} chiffres, puis scannez votre visage pour pointer.
        </Text>

        <Card style={styles.card}>
          <CodeKeypad
            length={CODE_LENGTH}
            value={code}
            onChange={handleCodeChange}
            disabled={codeVerifying || !!lockedUntil}
          />
          {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}
          {lockedUntil ? (
            <Text style={styles.errorText}>Borne verrouillée : {lockCountdown}s restantes.</Text>
          ) : null}
        </Card>
      </View>

      <Text style={styles.footer}>Développé par Jerttech</Text>
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
  heroIconWrap: { alignItems: 'center', marginBottom: spacing.sm },
  title: { ...typography.h1, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  card: { marginTop: spacing.sm, alignItems: 'center' },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: 'center',
  },
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
  resultText: { color: colors.white, fontWeight: '600', fontSize: 15, marginLeft: spacing.sm, flex: 1 },
  resultTextSuccess: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
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
