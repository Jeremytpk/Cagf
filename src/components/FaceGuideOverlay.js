import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, radius } from '../theme/theme';

const RING_COLORS = {
  idle: colors.white,
  scanning: colors.warning,
  success: colors.accent,
  error: colors.danger,
};

// Superpose un cadre sombre avec un carré transparent au centre pour guider
// le cadrage du visage, sans dépendance externe (juste 4 rectangles + un cadre).
// width/height doivent être ceux du conteneur caméra réel (mesuré via onLayout
// par le parent), pas ceux de l'écran — sinon le cadre est mal proportionné
// et mal centré dès que la caméra n'occupe pas tout l'écran.
export default function FaceGuideOverlay({ status = 'idle', hint, width = 0, height = 0 }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'scanning') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  if (!width || !height) return null;

  const side = Math.min(width, height) * 0.68;
  const squareTop = (height - side) / 2;
  const squareLeft = (width - side) / 2;
  const ringColor = RING_COLORS[status] || RING_COLORS.idle;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.shade, { height: squareTop }]} />
      <View style={[styles.shade, { top: squareTop + side, bottom: 0 }]} />
      <View style={[styles.shade, { top: squareTop, height: side, width: squareLeft }]} />
      <View
        style={[styles.shade, { top: squareTop, height: side, left: squareLeft + side, right: 0 }]}
      />
      <Animated.View
        style={[
          styles.frame,
          {
            width: side,
            height: side,
            top: squareTop,
            left: squareLeft,
            borderColor: ringColor,
            transform: [{ scale: pulse }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  frame: {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: radius.lg,
  },
});
