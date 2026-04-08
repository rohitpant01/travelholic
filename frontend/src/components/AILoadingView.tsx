import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, COLORS, SPACING, FONTS } from '../utils/theme';

const { width, height } = Dimensions.get('window');

const TIPS = [
  "Mapping your adventure...",
  "Searching for hidden gems...",
  "Consulting with local experts...",
  "Optimizing your travel route...",
  "Finding the best photo spots...",
  "Lyra is working her magic...",
  "Checking weather & best times...",
  "Vetting top-rated boutique stays...",
  "Finalizing your perfect itinerary..."
];

const AILoadingView = () => {
  const theme = useAppTheme();
  const [tipIndex, setTipIndex] = useState(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Pulsing Airplane
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    // 2. Rotating Border
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.linear })
    ).start();

    // 3. Fake Progress Bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 15000,
      useNativeDriver: false,
      easing: Easing.linear
    }).start();

    // 4. Tip Rotation
    const tipInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(textOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.delay(100),
      ]).start(() => {
        setTipIndex((prev) => (prev + 1) % TIPS.length);
        Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, 3000);

    return () => clearInterval(tipInterval);
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '90%'] // Stop at 90% until done
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.mode === 'dark' ? '#020510' : '#E0FFF9', theme.background]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Orbit Circle */}
      <View style={styles.centerContainer}>
        <Animated.View style={[styles.orbit, { transform: [{ rotate: spin }], borderColor: theme.teal + '40' }]}>
          <View style={[styles.orbitDot, { backgroundColor: theme.teal }]} />
        </Animated.View>

        <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={['#00C9A7', '#008E7F']}
            style={styles.iconCircle}
          >
            <Ionicons name="airplane" size={40} color="#fff" />
          </LinearGradient>
        </Animated.View>
      </View>

      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.text }]}>EkalGo AI Magic</Text>
        <Animated.Text style={[styles.tipText, { color: theme.textSecondary, opacity: textOpacity }]}>
          {TIPS[tipIndex]}
        </Animated.Text>

        {/* Progress Bar Container */}
        <View style={[styles.progressContainer, { backgroundColor: theme.borderLight }]}>
          <Animated.View style={[styles.progressBar, { width: barWidth, backgroundColor: theme.teal }]} />
        </View>
        <Text style={[styles.subText, { color: theme.textLight }]}>This takes about 10 seconds. Good things coming!</Text>
      </View>

      <View style={styles.footer}>
        <Ionicons name="sparkles" size={16} color={theme.teal} style={{ marginRight: 6 }} />
        <Text style={styles.teamText}>POWERED BY EkalGo AI</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  centerContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  orbit: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  orbitDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: -5,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,201,167,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: 1,
  },
  tipText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 24,
    marginBottom: 30,
  },
  progressContainer: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  subText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  teamText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: 'gray',
  }
});

export default AILoadingView;
