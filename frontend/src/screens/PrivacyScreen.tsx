import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, COLORS, RADIUS, SHADOW, FONTS } from '../utils/theme';

const { height } = Dimensions.get('window');

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const theme = useAppTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={[styles.header, { color: theme.text }]}>Privacy Policy</Text>
      <Text style={styles.lastUpdated}>Last Updated: Mar 27, 2026</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.bodyText, { color: theme.text }]}>
          Your privacy matters to us. This policy explains how we collect and use data.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Information We Collect</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          • Name and email (via Google login){'\n'}
          • App usage data{'\n'}
          • Saved destinations (bucket list)
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>2. How We Use Data</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          • To personalize your experience{'\n'}
          • To improve app performance{'\n'}
          • To provide recommendations
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>3. Third-Party Services</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          We may use:{'\n'}
          • Google Authentication{'\n'}
          • Maps APIs{'\n'}
          • Image APIs (Unsplash, Pexels){'\n\n'}
          These services may collect limited data as per their policies.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>4. Data Security</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          We use standard security measures to protect your data, but no system is 100% secure.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Your Control</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          • You can log out anytime{'\n'}
          • You can delete saved data (bucket list)
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>6. Updates</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          We may update this policy. Continued use means acceptance.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.goBack()}>
          <LinearGradient
            colors={['#00C9A7', '#00A8E8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Accept & Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.mode === 'dark' ? '#1E1E1E' : '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: 15,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(150,150,150,0.3)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 12,
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.1)',
  },
  btn: {
    height: 56,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.md,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
