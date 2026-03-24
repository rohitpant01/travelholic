import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, Image,
  Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { RootState } from '../store';
import { FontAwesome5 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function SplashScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated, isLoading } = useSelector((s: RootState) => s.auth);

  // Opacity controls
  const mapOpacity = useRef(new Animated.Value(0)).current;

  // Phase 1: Movement
  const leftPersonX = useRef(new Animated.Value(-120)).current;
  const rightPersonX = useRef(new Animated.Value(120)).current;

  // Phase 2: Shoulder Contact Glow
  const contactGlow = useRef(new Animated.Value(0)).current;

  // Phase 3: Heart
  const heartDash = useRef(new Animated.Value(150)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const heartGlow = useRef(new Animated.Value(0)).current;

  // Phase 4: Plane
  const planeAnim = useRef(new Animated.Value(0)).current;
  const planeOpacity = useRef(new Animated.Value(0)).current;

  // Phase 5: Brand
  const brandOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Subtle Map fade
    Animated.timing(mapOpacity, {
      toValue: 0.35,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // STEP 1: Move towards center (SHOULDER MEET)
    Animated.parallel([
      Animated.timing(leftPersonX, {
        toValue: 43, // Move inwards to meet shoulder
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(rightPersonX, {
        toValue: -43, // Move inwards to meet shoulder
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // STEP 2: When shoulders meet → glow
      triggerShoulderContact();
    });

    return () => {};
  }, [isLoading, isAuthenticated]);

  const triggerShoulderContact = () => {
    // small glow pulse at contact point
    Animated.sequence([
      Animated.timing(contactGlow, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(contactGlow, {
        toValue: 0.5,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // ⛔ IMPORTANT: DELAY BEFORE HEART
    setTimeout(() => {
      startHeartAnimation();
    }, 500); // THIS FIXES YOUR PROBLEM
  };

  const startHeartAnimation = () => {
    Animated.parallel([
      Animated.timing(heartOpacity, {
        toValue: 1,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(heartDash, {
        toValue: 0,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      startPlane();

      Animated.loop(
        Animated.sequence([
          Animated.timing(heartGlow, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(heartGlow, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  };

  const startPlane = () => {
    // 5. Plane takes off
    Animated.parallel([
      Animated.timing(planeOpacity, { toValue: 1, duration: 0, useNativeDriver: true }),
      Animated.timing(planeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      showText();
    });
  };

  const showText = () => {
    // 6. Brand fades in
    Animated.timing(brandOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      // Immediate navigation after branding
      if (!isLoading) {
        navigation.replace(isAuthenticated ? 'MainTabs' : 'Landing');
      }
    });
  };

  // Interpolations
  const planeX = planeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 90],
  });
  const planeY = planeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -height * 0.45],
  });
  const planeRot = planeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '40deg'],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0a0b16', '#020510']}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.Image
        source={require('../../assets/splash/map.png')}
        style={[styles.map, { opacity: mapOpacity }]}
        resizeMode="contain"
      />

      <View style={styles.sceneContainer}>

        <View style={styles.characterContainer}>
          {/* Left Person (Girl) */}
          <Animated.View
            style={[
              styles.characterWrap,
              {
                transform: [{ translateX: leftPersonX }],
              },
            ]}
          >
            <Image source={require('../../assets/splash/girl.png')} style={styles.charImg} resizeMode="contain" />
          </Animated.View>

          {/* Right Person (Boy) */}
          <Animated.View
            style={[
              styles.characterWrap,
              {
                transform: [{ translateX: rightPersonX }],
              },
            ]}
          >
            <Image source={require('../../assets/splash/boy.png')} style={styles.charImg} resizeMode="contain" />
          </Animated.View>
        </View>

        {/* Contact Glow (Neon Heart Shaped) */}
        <Animated.View
          style={[
            styles.contactGlow,
            {
              opacity: contactGlow,
              transform: [{ scale: contactGlow }],
            },
          ]}
        >
          <Svg width="30" height="30" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="heartGradient" cx="50%" cy="40%" r="60%" gradientUnits="userSpaceOnUse">
                <Stop offset="0%" stopColor="#c084fc" stopOpacity="0.9" />
                <Stop offset="70%" stopColor="#a855f7" stopOpacity="0.6" />
                <Stop offset="100%" stopColor="#a855f7" stopOpacity="0.2" />
              </RadialGradient>
            </Defs>
            
            {/* Background Layer (Soft Inner Glow) */}
            <Path
              d="M50 85 C20 65 10 45 10 30 C10 10 35 10 50 30 C65 10 90 10 90 30 C90 45 80 65 50 85"
              fill="url(#heartGradient)"
              opacity="0.6"
            />

            {/* Foreground Layer (Sharp Outline + Main Gradient) */}
            <Path
              d="M50 85 C20 65 10 45 10 30 C10 10 35 10 50 30 C65 10 90 10 90 30 C90 45 80 65 50 85"
              fill="url(#heartGradient)"
              stroke="#a855f7"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>

        {/* Heart */}
        <Animated.View style={[styles.heartContainer, { opacity: heartOpacity }]}>
          <Svg width="100" height="100" viewBox="0 0 100 100">
            <AnimatedPath
              d="M50 85 C20 65 10 45 10 30 C10 10 35 10 50 30"
              fill="none" stroke="#A855F7" strokeWidth="2.5"
              strokeDasharray="150" strokeDashoffset={heartDash} strokeLinecap="round"
            />
            <AnimatedPath
              d="M50 85 C80 65 90 45 90 30 C90 10 65 10 50 30"
              fill="none" stroke="#A855F7" strokeWidth="2.5"
              strokeDasharray="150" strokeDashoffset={heartDash} strokeLinecap="round"
            />
          </Svg>
          <Animated.View style={[styles.heartInnerGlow, { opacity: heartGlow }]} />
        </Animated.View>

        {/* Plane */}
        <Animated.View style={[styles.planeContainer, {
          opacity: planeOpacity,
          transform: [
            { translateX: planeX },
            { translateY: planeY },
            { rotate: planeRot }
          ]
        }]}>
          <FontAwesome5 name="plane" size={16} color="#FFFFFF" />
          <View style={styles.trail} />
        </Animated.View>

      </View>

      {/* Brand */}
      <Animated.View style={[styles.footer, { opacity: brandOpacity }]}>
        <Text style={styles.appName}>TRAVELHOLIC</Text>
        <Text style={styles.tagline}>Journey Together</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    width: width,
    height: height,
  },
  sceneContainer: {
    width: 300,
    height: 300,
    position: 'relative',
    alignItems: 'center',
  },
  characterContainer: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: 300,
    height: 200,
    zIndex: 5,
  },
  characterWrap: {
    width: 120,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 0,
  },
  charImg: {
    width: '100%',
    height: '100%',
  },
  contactGlow: {
    position: 'absolute',
    left: 150 - 15,
    top: 100 - 15,
    width: 30,
    height: 30,
    zIndex: 10,
    shadowColor: '#A855F7',
    shadowRadius: 15,
    shadowOpacity: 1,
  },
  heartContainer: {
    position: 'absolute',
    left: 150 - 50,
    top: 100 - 60, // FIXED alignment with shoulders
    width: 100,
    height: 100,
    zIndex: 15,
  },
  heartInnerGlow: {
    position: 'absolute',
    left: 50 - 30,
    top: 45 - 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(168, 85, 247, 0.35)',
    shadowColor: '#A855F7',
    shadowRadius: 25,
    shadowOpacity: 0.9,
  },
  planeContainer: {
    position: 'absolute',
    left: 150 - 8,
    top: 45 - 8,
    zIndex: 20,
  },
  trail: {
    position: 'absolute',
    bottom: -35,
    left: 8,
    width: 1.5,
    height: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  footer: {
    position: 'absolute',
    bottom: height * 0.12,
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
