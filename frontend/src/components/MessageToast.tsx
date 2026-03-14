import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, TouchableOpacity, Image, StyleSheet, Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS, SHADOW } from '../utils/theme';

interface ToastMessage {
  senderName: string;
  senderPhoto?: string;
  text: string;
  matchId: string;
  userId: string;
  unreadCount?: number;
}

interface Props {
  message: ToastMessage | null;
  onDismiss: () => void;
}

const { width: W } = Dimensions.get('window');

export default function MessageToast({ message, onDismiss }: Props) {
  const navigation = useNavigation<any>();
  const slideY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message) {
      // Slide in
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      // Auto-dismiss after 4 seconds
      timerRef.current = setTimeout(() => {
        dismiss();
      }, 4000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message]);

  const dismiss = () => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: -120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const handlePress = () => {
    if (message) {
      dismiss();
      // Only navigate to chat if there's an actual match
      if (message.matchId) {
        navigation.navigate('Chat', {
          matchId: message.matchId,
          userName: message.senderName,
          userPhoto: message.senderPhoto,
          userId: message.userId,
        });
      }
    }
  };

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideY }], opacity }]}
    >
      <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.9}>
        <View style={styles.avatarWrapper}>
          {message.senderPhoto ? (
            <Image source={{ uri: message.senderPhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={{ fontSize: 20 }}>✈️</Text>
            </View>
          )}
          {message.unreadCount && message.unreadCount > 1 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{message.unreadCount > 99 ? '99+' : message.unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.textArea}>
          <Text style={styles.senderName} numberOfLines={1}>{message.senderName}</Text>
          <Text style={styles.messageText} numberOfLines={1}>{message.text}</Text>
        </View>
        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={COLORS.textLight} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    paddingTop: 52, // safe area
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl || 20,
    padding: 12,
    gap: 12,
    ...SHADOW.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: {
    backgroundColor: COLORS.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  unreadText: { fontSize: 10, color: COLORS.white, fontWeight: '800' },
  textArea: { flex: 1 },
  senderName: { fontSize: FONTS.sm, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  messageText: { fontSize: FONTS.sm, color: COLORS.textSecondary },
  dismissBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
