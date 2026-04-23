import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, SPACING, FONTS, RADIUS } from '../utils/theme';

export default function PrivacySafetyScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const styles = getStyles(theme);

  const sections = [
    {
      title: '📌 Data We Collect',
      items: [
        'Basic details: Name, email, profile info',
        'Travel data: Trips, itineraries, locations you add',
        'Device data: App usage, crash logs (for improving performance)'
      ]
    },
    {
      title: '📍 Location Usage',
      items: [
        'We use your location only when required (e.g., itinerary planning, nearby suggestions)',
        'Location is never shared publicly without your permission'
      ]
    },
    {
      title: '🔐 Data Security',
      items: [
        'Your data is protected using industry-standard encryption',
        'Sensitive data is stored securely and access is restricted',
        'We do not sell your data to third parties'
      ]
    },
    {
      title: '👤 User Control',
      content: 'You have full control over your data:',
      items: [
        'Edit or update your profile anytime',
        'Delete your account permanently',
        'Control what you share publicly'
      ]
    },
    {
      title: '⚠️ Safety Guidelines',
      items: [
        'Do not share sensitive personal information publicly',
        'Verify travel information before acting on it',
        'Report suspicious or harmful content'
      ]
    },
    {
      title: '🚨 Reporting & Blocking',
      items: [
        'You can report users or content directly in the app',
        'We take strict action against misuse, abuse, or fake content'
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate('MainTabs')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Safety</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          At EkalGo, we are committed to protecting your personal data and ensuring a safe travel experience.
        </Text>

        {sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content && <Text style={styles.sectionContent}>{section.content}</Text>}
            <View style={styles.list}>
              {section.items.map((item, i) => (
                <View key={i} style={styles.listItem}>
                  <View style={styles.bullet} />
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity 
          style={styles.reportsLink} 
          onPress={() => navigation.navigate('MyReports' as any)}
        >
          <View style={styles.reportsLinkContent}>
            <Ionicons name="flag-outline" size={20} color={theme.teal} />
            <Text style={styles.reportsLinkText}>View My Filed Reports</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
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
  intro: { fontSize: FONTS.base, color: theme.textSecondary, marginBottom: SPACING.xl, lineHeight: 22 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: theme.text, marginBottom: SPACING.sm },
  sectionContent: { fontSize: FONTS.sm, color: theme.textSecondary, marginBottom: SPACING.xs },
  list: { marginTop: SPACING.xs },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, paddingRight: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.teal, marginTop: 8, marginRight: 10 },
  itemText: { flex: 1, fontSize: FONTS.sm, color: theme.textSecondary, lineHeight: 20 },
  reportsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.white,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  reportsLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportsLinkText: {
    fontSize: FONTS.base,
    fontWeight: '600',
    color: theme.text,
    marginLeft: 12,
  },
});
