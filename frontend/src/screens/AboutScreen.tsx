import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, SPACING, FONTS, RADIUS, COLORS } from '../utils/theme';

export default function AboutScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const styles = getStyles(theme);

  const keyFeatures = [
    { icon: 'map-outline', text: 'AI-based itinerary planning' },
    { icon: 'camera-outline', text: 'Post trips with photos & locations' },
    { icon: 'share-social-outline', text: 'Share trips via link' },
    { icon: 'navigate-outline', text: 'Smart route and distance suggestions' },
    { icon: 'globe-outline', text: 'Explore places shared by other travelers' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About EkalGo</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandSection}>
          <View style={styles.logoPlaceholder}>
            <Ionicons name="airplane" size={40} color={theme.white} />
          </View>
          <Text style={styles.brandName}>EkalGo</Text>
          <Text style={styles.version}>Version: v1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌍 What is EkalGo?</Text>
          <Text style={styles.description}>
            EkalGo is an AI-powered travel planning and social platform that helps users create smart itineraries, share travel experiences, and discover new destinations.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Key Features</Text>
          {keyFeatures.map((feature, idx) => (
            <View key={idx} style={styles.featureItem}>
              <Ionicons name={feature.icon as any} size={20} color={theme.teal} />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Our Mission</Text>
          <Text style={styles.description}>
            To make travel planning simple, social, and intelligent for everyone.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚀 Vision</Text>
          <Text style={styles.description}>
            To build a global travel community where people can Discover, Plan, Share, and Inspire.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Built with ❤️ to help travelers explore the world smarter.</Text>
          <Text style={styles.copyright}>© 2026 EkalGo. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.white,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FONTS.lg, fontWeight: '700', color: theme.text },
  content: { padding: SPACING.lg },
  brandSection: { alignItems: 'center', marginVertical: SPACING.xl },
  logoPlaceholder: {
    width: 80, height: 80, borderRadius: 20, 
    backgroundColor: theme.teal, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: theme.teal, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },
  brandName: { fontSize: 28, fontWeight: '900', color: theme.text },
  version: { fontSize: FONTS.sm, color: theme.textLight, marginTop: 4 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONTS.lg, fontWeight: '700', color: theme.text, marginBottom: 12 },
  description: { fontSize: FONTS.base, color: theme.textSecondary, lineHeight: 24 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  featureText: { fontSize: FONTS.base, color: theme.textSecondary },
  footer: { 
    marginTop: SPACING.xl, paddingBottom: SPACING.xl, 
    alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.border,
    paddingTop: SPACING.xl
  },
  footerText: { fontSize: FONTS.sm, color: theme.textSecondary, textAlign: 'center', marginBottom: 8 },
  copyright: { fontSize: FONTS.xs, color: theme.textLight }
});
