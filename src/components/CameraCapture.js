import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import FaceGuideOverlay from './FaceGuideOverlay';
import PrimaryButton from './PrimaryButton';
import { colors, radius, spacing, typography } from '../theme/theme';

// Composant caméra réutilisable : cadre carré de guidage, bascule
// avant/arrière, et retourne une image compressée en base64 (JPEG).
export default function CameraCapture({
  onCapture,
  onCancel,
  showFacingToggle = true,
  defaultFacing = 'front',
  status = 'idle',
  hint = 'Centrez votre visage dans le carré',
  resizeWidth = 480,
  compressQuality = 0.7,
  style,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState(defaultFacing);
  const [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const cameraRef = useRef(null);

  const handleLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  const toggleFacing = () => setFacing((prev) => (prev === 'front' ? 'back' : 'front'));

  const handleCapture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      const manipulated = await manipulateAsync(
        photo.uri,
        [{ resize: { width: resizeWidth } }],
        { compress: compressQuality, format: SaveFormat.JPEG, base64: true }
      );
      onCapture?.(manipulated.base64);
    } catch (error) {
      onCapture?.(null, error);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return <View style={[styles.container, styles.center, style]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center, styles.permissionBox, style]}>
        <Ionicons name="camera-outline" size={40} color={colors.textSecondary} />
        <Text style={styles.permissionText}>
          L'accès à la caméra est nécessaire pour la reconnaissance faciale.
        </Text>
        <PrimaryButton label="Autoriser la caméra" onPress={requestPermission} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
      <FaceGuideOverlay status={status} width={layout.width} height={layout.height} />

      <View style={styles.hintWrap} pointerEvents="none">
        <Text style={styles.hintText}>{hint}</Text>
      </View>

      <View style={styles.topRow}>
        {onCancel ? (
          <TouchableOpacity style={styles.iconButton} onPress={onCancel}>
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View />
        )}
        {showFacingToggle ? (
          <TouchableOpacity style={styles.iconButton} onPress={toggleFacing}>
            <Ionicons name="camera-reverse-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity
          style={[styles.captureButton, busy && styles.captureButtonBusy]}
          onPress={handleCapture}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={16} color={colors.white} />
          <Text style={styles.captureButtonText}>{busy ? 'Capture...' : 'Prendre la photo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  permissionBox: { backgroundColor: colors.surface, padding: spacing.lg },
  permissionText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  hintWrap: {
    position: 'absolute',
    top: '16%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  topRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1.5,
    borderColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  captureButtonBusy: { opacity: 0.5 },
  captureButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: spacing.xs,
  },
});
