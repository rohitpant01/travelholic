import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, FONTS, SPACING } from '../utils/theme';

interface Props {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export default function RegisterHeader({ step, totalSteps, title, subtitle, onBack }: Props) {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const progress = step / totalSteps;

  return (
    <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.container}>
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.textWhite} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.stepLabel}>Step {step} of {totalSteps}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </LinearGradient>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    paddingTop: 56, paddingBottom: 28, paddingHorizontal: SPACING.lg,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  backBtn: { padding: 4 },
  stepLabel: {
    fontSize: FONTS.sm, color: 'rgba(255,255,255,0.8)', fontWeight: '600',
  },
  progressBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2, marginBottom: 20, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: theme.textWhite, borderRadius: 2,
  },
  title: {
    fontSize: FONTS.xxl, fontWeight: '800', color: theme.textWhite, marginBottom: 4,
  },
  subtitle: {
    fontSize: FONTS.md, color: 'rgba(255,255,255,0.75)',
  },
});
