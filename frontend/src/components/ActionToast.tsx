import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated, StyleSheet, TouchableOpacity, Dimensions, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../context/ToastContext';
import { COLORS, SHADOW, RADIUS, FONTS } from '../utils/theme';

const { width: W } = Dimensions.get('window');

export const ActionToast: React.FC = () => {
  const { toasts, hideToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => hideToast(toast.id)} />
      ))}
    </View>
  );
};

const ToastItem: React.FC<{ toast: any; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 2.7s (slightly before context removes it)
    const timer = setTimeout(() => {
      handleDismiss();
    }, 2700);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 250, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return { name: 'checkmark-circle', color: '#10B981' };
      case 'error': return { name: 'alert-circle', color: '#EF4444' };
      default: return { name: 'information-circle', color: COLORS.teal };
    }
  };

  const icon = getIcon();

  return (
    <Animated.View style={[
      styles.toast,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <TouchableOpacity 
        style={styles.content} 
        onPress={handleDismiss}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon.name as any} size={24} color={icon.color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{toast.title}</Text>
          <Text style={styles.message}>{toast.message}</Text>
        </View>
        <Ionicons name="close" size={16} color={COLORS.textLight} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    zIndex: 10000,
    gap: 8,
  },
  toast: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg || 16,
    ...SHADOW.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingRight: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONTS.sm,
    fontWeight: '800',
    color: COLORS.text,
  },
  message: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
