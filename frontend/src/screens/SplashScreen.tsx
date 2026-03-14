import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { COLORS, FONTS } from '../utils/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated, isLoading } = useSelector((s: RootState) => s.auth);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]),
      Animated.timing(taglineAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      if (!isLoading) {
        navigation.replace(isAuthenticated ? 'MainTabs' : 'Landing');
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated]);

  return (
    <LinearGradient
      colors={[COLORS.teal, COLORS.tealDark, '#005555']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Decorative circles */}
      <View style={[styles.circle, styles.circle1]} />
      <View style={[styles.circle, styles.circle2]} />
      <View style={[styles.circle, styles.circle3]} />

      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: logoAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.logoIcon}>
          <Text style={styles.logoEmoji}>✈️</Text>
        </View>
        <Text style={styles.logoText}>TravelHolic</Text>
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: taglineAnim }]}>
        Find Your Travel Soulmate
      </Animated.Text>

      <Animated.View style={[styles.dotsContainer, { opacity: taglineAnim }]}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circle1: { width: 300, height: 300, top: -80, right: -80 },
  circle2: { width: 200, height: 200, bottom: 100, left: -60 },
  circle3: { width: 150, height: 150, bottom: -40, right: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoEmoji: { fontSize: 52 },
  logoText: {
    fontSize: FONTS.display,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: FONTS.lg,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 60,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: { backgroundColor: COLORS.white, width: 24 },
});
