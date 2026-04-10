import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ImageBackground, StatusBar, Image, ScrollView,
  Platform, ActivityIndicator, Alert, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn
} from 'react-native-reanimated';
import { fetchRandomTravelImages, getRichDestinations } from '../api/imageService';
import { aiAPI, userAPI } from '../api/services';
import GoogleSignInButton from '../components/GoogleSignInButton';

const { width, height } = Dimensions.get('window');
const ANIMATED_WORDS = ["Unseen", "Offbeat", "Hidden"];


const LandingScreen = () => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // States
  const [heroImage, setHeroImage] = useState('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1000&auto=format&fit=crop');
  const [modalVisible, setModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  // Animation Shared Values
  const buttonScale = useSharedValue(1);

  // Typing Animation States
  const [displayText, setDisplayText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  // Typing Logic
  useEffect(() => {
    const currentWord = ANIMATED_WORDS[wordIndex];
    const typingSpeed = isDeleting ? 40 : 100;
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setDisplayText(currentWord.substring(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
        if (charIndex + 1 === currentWord.length) {
          setTimeout(() => setIsDeleting(true), 2000); // Pause on full word
        }
      } else {
        setDisplayText(currentWord.substring(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
        if (charIndex - 1 === 0) {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % ANIMATED_WORDS.length);
        }
      }
    }, typingSpeed);
    
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, wordIndex]);

  // Cursor Blink
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const imgs = await fetchRandomTravelImages(1);
      if (imgs && imgs.length > 0) setHeroImage(imgs[0].image);
    } catch (err) {
      console.warn('Landing data load failed:', err);
    }
  };


  const pickHeroImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setHeroImage(result.assets[0].uri);
    }
  };



  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(buttonScale.value) }]
  }));

  const handleDestinationClick = (item: any) => {
    Alert.alert(
      '✨ ' + item.name,
      'Login and explore the Explore tab to save this destination to your bucket list!',
      [
        { text: 'OK', style: 'default' },
        { text: 'Login', onPress: () => (navigation.navigate as any)('Login') }
      ]
    );
  };


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO SECTION */}
        <ImageBackground source={{ uri: heroImage }} style={styles.hero}>
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', theme.background]}
            style={styles.heroOverlay}
          >
            <SafeAreaView style={styles.heroHeader}>
              <View style={styles.headerRow}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setAboutModalVisible(true)}>
                  <Animated.View entering={FadeIn.delay(200)} style={styles.logoTag}>
                    <Image source={require('../../assets/logo.png')} style={{ width: 22, height: 22, borderRadius: 6 }} />
                    <Text style={styles.logoTagText}>EKAL<Text style={{ color: '#F7A731' }}>GO</Text></Text>
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            <Animated.View entering={FadeInDown.duration(1000).springify()} style={styles.heroBottom}>
              <View>
                <Text style={styles.heroMain}>
                  {displayText}
                  <Text style={{ opacity: showCursor ? 1 : 0 }}>|</Text>
                </Text>
                <Text style={styles.heroSub}>with EKAL<Text style={{ color: '#F7A731' }}>GO</Text></Text>
              </View>
              <View style={styles.heroButtonsContainer}>
                <GoogleSignInButton title="Continue with Google" />

                <View style={[styles.dividerContainer, { marginVertical: 15 }]}>
                  <View style={[styles.line, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                  <Text style={[styles.orText, { color: 'rgba(255,255,255,0.9)' }]}>OR</Text>
                  <View style={[styles.line, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPressIn={() => buttonScale.value = 0.95}
                  onPressOut={() => buttonScale.value = 1}
                  onPress={() => (navigation.navigate as any)('Login')}
                >
                  <Animated.View style={[styles.mainBtn, btnAnimatedStyle, { height: 56 }]}>
                    <LinearGradient
                      colors={['#00C9A7', '#00A8E8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.gradientBtn}
                    >
                      <Text style={styles.mainBtnText}>Continue Your Journey</Text>
                    </LinearGradient>
                  </Animated.View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => (navigation.navigate as any)('Register_Step1')}
                  style={styles.loginLink}
                >
                  <Text style={styles.loginLinkText}>
                    Join the Journey
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </LinearGradient>
        </ImageBackground>


        {/* ACTIONS / Terms */}
        <View style={styles.actions}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{" "}
            <Text style={styles.link} onPress={() => (navigation.navigate as any)("TermsScreen")}>
              Terms
            </Text>{" "}
            and{" "}
            <Text style={styles.link} onPress={() => (navigation.navigate as any)("PrivacyScreen")}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </ScrollView>


      {/* About App Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={aboutModalVisible}
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <View style={styles.aboutModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setAboutModalVisible(false)} />
          <View style={[styles.aboutModalContent, { backgroundColor: theme.mode === 'dark' ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)' }]}>
            <LinearGradient
              colors={['rgba(0,201,167,0.15)', 'transparent']}
              style={styles.aboutHeaderGradient}
            />

            <View style={styles.aboutHeaderHandle} />

            <ScrollView contentContainerStyle={styles.aboutScroll} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Image source={require('../../assets/logo.png')} style={{ width: 45, height: 45, borderRadius: 12, marginRight: 15 }} />
                <View>
                  <Text style={[styles.aboutHeaderTitle, { color: theme.text }]}>
                    EKAL<Text style={{ color: '#F7A731' }}>GO</Text>
                  </Text>
                  <Text style={styles.aboutHeaderSubtitle}>From Solo Trips to Shared Memories.</Text>
                </View>
              </View>

              <Text style={[styles.aboutDescription, { color: theme.text }]}>
                Experience a revolutionary travel platform that connects you with global explorers, AI-curated itineraries, and breathtaking destinations instantly.
              </Text>

              <View style={styles.featuresList}>
                <View style={[styles.featureItem, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="compass" size={20} color={COLORS.teal} />
                  </View>
                  <Text style={[styles.featureText, { color: theme.text }]}>Discover Hidden Gems</Text>
                </View>
                <View style={[styles.featureItem, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="chatbubbles" size={20} color={COLORS.teal} />
                  </View>
                  <Text style={[styles.featureText, { color: theme.text }]}>Connect with Travelers</Text>
                </View>
                <View style={[styles.featureItem, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="map" size={20} color={COLORS.teal} />
                  </View>
                  <Text style={[styles.featureText, { color: theme.text }]}>AI-Powered Itineraries</Text>
                </View>
              </View>

              <Text style={[styles.aboutSectionTitle, { color: theme.text }]}>Why Choose EkalGo?</Text>
              <View style={styles.bulletPointsContainer}>
                <View style={styles.bulletPointRow}><Text style={styles.bulletDot}>•</Text><Text style={[styles.bulletPointText, { color: theme.textLight }]}>Real-time location matching</Text></View>
                <View style={styles.bulletPointRow}><Text style={styles.bulletDot}>•</Text><Text style={[styles.bulletPointText, { color: theme.textLight }]}>Instant messaging and media sharing</Text></View>
                <View style={styles.bulletPointRow}><Text style={styles.bulletDot}>•</Text><Text style={[styles.bulletPointText, { color: theme.textLight }]}>Community-driven rich travel data</Text></View>
              </View>

              <View style={styles.aboutQuoteBox}>
                <FontAwesome5 name="quote-left" size={14} color={COLORS.teal} style={{ marginBottom: 8 }} />
                <Text style={[styles.aboutQuoteText, { color: theme.text }]}>
                  "To travel is to discover that everyone is wrong about other countries."
                </Text>
              </View>

              <View style={styles.aboutFooter}>
                <Text style={styles.craftedText}>Crafted with passion by</Text>
                <Text style={[styles.teamTitle, { color: theme.text }]}>Team EkalGo</Text>
                <Text style={styles.taglineText}>Driven by curiosity, built for explorers</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setAboutModalVisible(false)}
              >
                <LinearGradient
                  colors={['#00C9A7', '#00A8E8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aboutBtn}
                >
                  <Text style={styles.aboutBtnText}>Start Exploring</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    width: width,
    height: height * 0.85,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  heroHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cartBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: COLORS.teal,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  logoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoTagText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
  iconBtn: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroBottom: { position: 'absolute', bottom: 30, left: 24, right: 24, zIndex: 10 },
  heroButtonsContainer: { marginTop: 24, width: '100%' },
  startBtn: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.teal,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...SHADOW.md,
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  loginBtnMini: {
    paddingHorizontal: 24,
    height: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  loginBtnMiniText: { color: '#fff', fontWeight: '700' },
  heroMain: {
    fontSize: 44,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroSub: {
    fontSize: 16,
    color: "#E0E0E0",
    marginTop: 6,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  actions: {
    paddingHorizontal: SPACING.lg,
    marginTop: 40,
  },
  mainBtn: {
    height: 60,
    borderRadius: 30,
    ...SHADOW.md,
  },
  gradientBtn: {
    flex: 1,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  line: {
    flex: 1,
    height: 1,
  },
  orText: {
    marginHorizontal: 15,
    fontSize: 14,
    fontWeight: '600',
  },
  loginBtn: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  loginText: {
    color: '#00A8E8',
    fontSize: 15,
    fontWeight: '600',
  },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  loginLink: {
    alignItems: 'center', marginTop: 15, backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignSelf: 'center',
  },
  loginLinkText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    minHeight: 300,
  },
  modalHeaderImage: {
    width: '100%', height: 200, position: 'absolute', top: 0, left: 0, right: 0,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, opacity: 0.6,
  },
  modalGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 200,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
  },
  modalTitle: { fontSize: 24, fontWeight: '900', marginTop: 80, marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalActions: { width: '100%', marginTop: 16 },
  modalBtn: {
    width: '100%', height: 56, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center', ...SHADOW.md,
  },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  aboutModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  aboutModalContent: {
    borderTopLeftRadius: 35, borderTopRightRadius: 35,
    minHeight: height * 0.75, maxHeight: height * 0.9,
    paddingTop: 15, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20,
  },
  aboutHeaderHandle: { width: 40, height: 5, backgroundColor: 'rgba(150,150,150,0.3)', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  aboutHeaderGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, borderTopLeftRadius: 35, borderTopRightRadius: 35 },
  aboutScroll: { paddingBottom: 20 },
  aboutHeaderTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  aboutHeaderSubtitle: { fontSize: 16, color: COLORS.teal, fontWeight: '700', marginTop: 4, marginBottom: 24 },
  aboutDescription: { fontSize: 15, lineHeight: 24, opacity: 0.8, marginBottom: 30 },
  featuresList: { gap: 12, marginBottom: 30 },
  featureItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16 },
  featureIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,201,167,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  featureText: { fontSize: 16, fontWeight: '700' },
  aboutSectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  bulletPointsContainer: { gap: 10, marginBottom: 30 },
  bulletPointRow: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 20 },
  bulletDot: { fontSize: 18, color: COLORS.teal, marginRight: 10, lineHeight: 22 },
  bulletPointText: { fontSize: 15, lineHeight: 22 },
  aboutQuoteBox: { backgroundColor: 'rgba(0,201,167,0.05)', padding: 20, borderRadius: 20, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(0,201,167,0.1)' },
  aboutQuoteText: { fontSize: 16, fontStyle: 'italic', fontWeight: '500', lineHeight: 24 },
  aboutFooter: { alignItems: 'center', marginBottom: 35 },
  craftedText: { fontSize: 12, color: 'gray', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  teamTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  taglineText: { fontSize: 14, color: COLORS.teal, fontStyle: 'italic', fontWeight: '600' },
  aboutBtn: { width: '100%', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', ...SHADOW.lg },
  aboutBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  footerText: {
    color: "#999",
    textAlign: "center",
    fontSize: 12,
    marginBottom: 40,
  },
  link: {
    color: "#00C6FF",
    fontWeight: "600",
  },
});

export default LandingScreen;
