import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { LogoGear, LogoLeaf } from './brand-logo';

/** Durasi minimum splash (ms) — cukup lama untuk kesan pertama, tidak terlalu lama. */
const MIN_DURATION = 3200;
const LOGO = 132;
const STEPS = ['Menyiapkan gudang…', 'Menghitung stok…', 'Memuat produksi…', 'Siap!'];

/**
 * Splash beranimasi di atas aplikasi. Warna latar sama dengan splash native
 * (hijau) sehingga peralihannya mulus. Hilang setelah animasi selesai DAN
 * aplikasi siap (`ready`).
 */
export function AnimatedSplash({ ready, onLayout, onFinish }: { ready: boolean; onLayout?: () => void; onFinish: () => void }) {
  const appear = useState(() => new Animated.Value(0))[0];
  const spin = useState(() => new Animated.Value(0))[0];
  const leaf = useState(() => new Animated.Value(0))[0];
  const pulse = useState(() => new Animated.Value(0))[0];
  const title = useState(() => new Animated.Value(0))[0];
  const tagline = useState(() => new Animated.Value(0))[0];
  const progress = useState(() => new Animated.Value(0))[0];
  const exit = useState(() => new Animated.Value(0))[0];
  const [step, setStep] = useState(0);
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(appear, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.timing(spin, { toValue: 1, duration: MIN_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([Animated.delay(450), Animated.spring(leaf, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true })]),
      Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }), { iterations: 3 }),
      Animated.sequence([Animated.delay(900), Animated.timing(title, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
      Animated.sequence([Animated.delay(1300), Animated.timing(tagline, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(progress, { toValue: 1, duration: MIN_DURATION - 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();

    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i), 600 + i * ((MIN_DURATION - 700) / (STEPS.length - 1))));
    timers.push(setTimeout(() => setMinDone(true), MIN_DURATION));
    return () => timers.forEach(clearTimeout);
  }, [appear, spin, leaf, pulse, title, tagline, progress]);

  useEffect(() => {
    if (!minDone || !ready) return;
    Animated.timing(exit, { toValue: 1, duration: 480, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onFinish());
  }, [minDone, ready, exit, onFinish]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '270deg'] });
  const fadeUp = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  });

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents="none"
      style={[styles.root, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      <Animated.View
        style={[
          styles.center,
          { transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] },
        ]}
      >
        <View style={styles.logoBox}>
          {/* gelombang cahaya */}
          <Animated.View
            style={[
              styles.pulse,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] }) }],
              },
            ]}
          />
          <Animated.View
            style={{
              opacity: appear,
              transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate }],
            }}
          >
            <LogoGear size={LOGO} />
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: leaf,
                transform: [
                  { scale: leaf },
                  { rotate: leaf.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] }) },
                ],
              },
            ]}
          >
            <LogoLeaf size={LOGO} />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.title, fadeUp(title)]}>Sasana Warehouse</Animated.Text>
        <Animated.Text style={[styles.tagline, fadeUp(tagline)]}>Kemasan · Produksi · Distribusi Jamu</Animated.Text>

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.bar,
              {
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-BAR_W / 2, 0] }) },
                  { scaleX: progress },
                ],
              },
            ]}
          />
        </View>
        <Text style={styles.step}>{STEPS[step]}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const BAR_W = 180;

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  center: { alignItems: 'center' },
  logoBox: { width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  pulse: { position: 'absolute', width: LOGO, height: LOGO, borderRadius: LOGO / 2, backgroundColor: '#FFFFFF' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: 0.4 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, letterSpacing: 0.6 },
  track: { width: BAR_W, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginTop: spacing.xxl },
  bar: { width: BAR_W, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  step: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: spacing.sm },
});
