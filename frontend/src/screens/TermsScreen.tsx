import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, COLORS, RADIUS, SHADOW, FONTS } from '../utils/theme';

const { height } = Dimensions.get('window');

export default function TermsScreen() {
  const navigation = useNavigation();
  const theme = useAppTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={[styles.header, { color: theme.text }]}>Terms of Service</Text>
      <Text style={styles.lastUpdated}>Last Updated: Mar 27, 2026</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.bodyText, { color: theme.text }]}>
          Welcome to EkalGo. By using our app, you agree to the following terms:
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>1. Use of Service</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          EkalGo allows users to explore destinations, create travel plans, and access booking services. You agree to use the app only for lawful purposes.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>2. User Accounts</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          • You may log in using Google or other methods{'\n'}
          • You are responsible for maintaining account security{'\n'}
          • We are not liable for unauthorized access
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>3. Bookings & Services</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          • EkalGo may integrate third-party services (hotels, cabs, etc.){'\n'}
          • We do not guarantee availability or pricing accuracy{'\n'}
          • Any disputes must be handled with the service provider
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>4. Content</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          • Destination details are for informational purposes only{'\n'}
          • Images and descriptions may come from third-party APIs
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>5. Limitation of Liability</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          EkalGo is not responsible for:{'\n'}
          • Travel delays{'\n'}
          • Booking issues{'\n'}
          • Losses during trips
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>6. Changes to Terms</Text>
        <Text style={[styles.bodyText, { color: theme.textLight }]}>
          We may update these terms at any time. Continued use means you accept changes.
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
