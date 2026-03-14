import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ImageBackground, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, RADIUS, SHADOW } from '../utils/theme';

const { width, height } = Dimensions.get('window');

export default function LandingScreen() {
  const navigation = useNavigation<any>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#003333', '#00B4B4', '#FF6B35']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative elements */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* Travel destination cards preview */}
      <View style={styles.cardsPreview}>
        <View style={[styles.previewCard, styles.previewCard1]}>
          <Text style={styles.previewEmoji}>🏔️</Text>
          <Text style={styles.previewLabel}>Himalayas</Text>
        </View>
        <View style={[styles.previewCard, styles.previewCard2]}>
          <Text style={styles.previewEmoji}>🏖️</Text>
          <Text style={styles.previewLabel}>Bali</Text>
        </View>
        <View style={[styles.previewCard, styles.previewCard3]}>
          <Text style={styles.previewEmoji}>🗼</Text>
          <Text style={styles.previewLabel}>Paris</Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>✈️</Text>
          <Text style={styles.logoText}>TravelHolic</Text>
        </View>

        <Text style={styles.tagline}>Find Your{'\n'}Travel Soulmate</Text>
        <Text style={styles.subtitle}>
          Connect with fellow travelers who share your adventure spirit
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>50K+</Text>
            <Text style={styles.statLabel}>Travelers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>120+</Text>
            <Text style={styles.statLabel}>Countries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>10K+</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Register_Step1')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[COLORS.orange, '#FF8C5A']}
            style={styles.btnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.primaryBtnText}>Create Account ✈️</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink}>Terms</Text> &{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  blob1: {
    position: 'absolute', width: 350, height: 350,
    borderRadius: 175, backgroundColor: 'rgba(255,107,53,0.2)',
    top: -100, right: -80,
  },
  blob2: {
    position: 'absolute', width: 250, height: 250,
    borderRadius: 125, backgroundColor: 'rgba(0,180,180,0.15)',
    top: 150, left: -60,
  },
  cardsPreview: {
    position: 'absolute', top: height * 0.1, width,
    flexDirection: 'row', justifyContent: 'center', gap: 12,
  },
  previewCard: {
    width: 95, height: 130, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  previewCard1: { transform: [{ rotate: '-8deg' }, { translateY: 10 }] },
  previewCard2: { transform: [{ scale: 1.1 }] },
  previewCard3: { transform: [{ rotate: '8deg' }, { translateY: 10 }] },
  previewEmoji: { fontSize: 36 },
  previewLabel: { color: 'white', fontSize: 11, fontWeight: '600', marginTop: 4 },
  content: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    padding: 32, paddingBottom: 48,
    ...SHADOW.lg,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  logoEmoji: { fontSize: 28 },
  logoText: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.teal },
  tagline: {
    fontSize: FONTS.xxxl, fontWeight: '800',
    color: COLORS.text, lineHeight: 38, marginBottom: 12,
  },
  subtitle: { fontSize: FONTS.md, color: COLORS.textSecondary, marginBottom: 24, lineHeight: 22 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.tealLight, borderRadius: 16,
    padding: 16, marginBottom: 28,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.teal },
  statLabel: { fontSize: FONTS.xs, color: COLORS.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  primaryBtn: { borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 14 },
  btnGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: RADIUS.full },
  primaryBtnText: { color: COLORS.white, fontSize: FONTS.lg, fontWeight: '700', letterSpacing: 0.3 },
  secondaryBtn: {
    borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLORS.teal,
    paddingVertical: 14, alignItems: 'center', marginBottom: 20,
  },
  secondaryBtnText: { color: COLORS.teal, fontSize: FONTS.lg, fontWeight: '600' },
  terms: { textAlign: 'center', fontSize: FONTS.xs, color: COLORS.textLight },
  termsLink: { color: COLORS.teal, fontWeight: '600' },
});
