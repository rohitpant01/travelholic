import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, SPACING, FONTS, RADIUS } from '../utils/theme';

export default function HelpSupportScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const styles = getStyles(theme);

  const sections = [
    {
      title: '📌 Common Help Topics',
      items: [
        'Creating and sharing itineraries',
        'Uploading photos and locations',
        'Account login or recovery',
        'App performance issues'
      ]
    },
    {
      title: '📩 Contact Support',
      items: [
        'Email: ekalgo.app@gmail.com',
        'Response time: 24–48 hours'
      ],
      action: () => Linking.openURL('mailto:ekalgo.app@gmail.com')
    },
    {
      title: '💬 In-App Support',
      content: 'Use the “Help & Support” section to:',
      items: [
        'Report bugs',
        'Suggest features',
        'Ask questions'
      ]
    },
    {
      title: '🔄 Troubleshooting Tips',
      items: [
        'Restart the app if something isn’t working',
        'Update to the latest version',
        'Check your internet connection'
      ]
    },
    {
      title: '💡 Feature Requests',
      items: [
        'We love feedback! Suggest new features to improve EkalGo.'
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🤝 We're Here to Help</Text>
          <Text style={styles.heroSubtitle}>Facing issues or have questions? EkalGo support is always available.</Text>
        </View>

        {sections.map((section, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.section}
            onPress={section.action}
            disabled={!section.action}
            activeOpacity={0.7}
          >
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
            {section.action && (
              <View style={styles.actionPrompt}>
                <Text style={styles.actionText}>Send an Email</Text>
                <Ionicons name="mail-outline" size={16} color={theme.teal} />
              </View>
            )}
          </TouchableOpacity>
        ))}
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
  hero: { marginBottom: SPACING.xl, alignItems: 'center', textAlign: 'center' },
  heroTitle: { fontSize: FONTS.xl, fontWeight: '800', color: theme.text, marginBottom: 8 },
  heroSubtitle: { fontSize: FONTS.base, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  section: {
    marginBottom: SPACING.lg,
    backgroundColor: theme.card,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: theme.border
  },
  sectionTitle: { fontSize: FONTS.base, fontWeight: '700', color: theme.text, marginBottom: SPACING.sm },
  sectionContent: { fontSize: FONTS.sm, color: theme.textSecondary, marginBottom: SPACING.xs },
  list: { marginTop: SPACING.xs },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.teal, marginTop: 8, marginRight: 10 },
  itemText: { flex: 1, fontSize: FONTS.sm, color: theme.textSecondary, lineHeight: 18 },
  actionPrompt: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 },
  actionText: { fontSize: FONTS.sm, color: theme.teal, fontWeight: '600' }
});
