import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatAPI } from '../api/services';
import { RootState } from '../store';
import { clearUnreadForMatch } from '../store/slices/chatSlice';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { API_BASE_URL } from '../api/client';

// Derive socket URL from API base (remove /api path)
const SOCKET_URL = API_BASE_URL.replace('/api', '');

interface Message {
  _id: string;
  sender: { _id: string; firstName: string; photos?: any[] };
  text?: string;
  imageUrl?: string;
  type: 'text' | 'image';
  isRead: boolean;
  createdAt: string;
}

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { matchId, userName, userPhoto, userId } = route.params;
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<any>(null);

  useEffect(() => {
    // Clear unread badge for this match when chat opens
    dispatch(clearUnreadForMatch(matchId));
    loadMessages();
    setupSocket();
    return () => {
      socketRef.current?.emit('leave_chat', { matchId });
      socketRef.current?.disconnect();
    };
  }, []);

  const loadMessages = async () => {
    try {
      const res = await chatAPI.getMessages(matchId);
      setMessages(res.data.messages);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const setupSocket = async () => {
    const token = await AsyncStorage.getItem('token');
    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      socketRef.current?.emit('join_chat', { matchId });
      socketRef.current?.emit('messages_read', { matchId });
    });

    socketRef.current.on('new_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
      flatListRef.current?.scrollToEnd({ animated: true });
      socketRef.current?.emit('messages_read', { matchId });
    });

    socketRef.current.on('typing', ({ userId: typingUserId, isTyping: typing }: any) => {
      if (typingUserId !== user?._id) setIsTyping(typing);
    });

    socketRef.current.on('user_online', ({ userId: uid, isOnline: online }: any) => {
      if (uid === userId) setIsOnline(online);
    });
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    socketRef.current?.emit('send_message', { matchId, text });
    socketRef.current?.emit('typing_stop', { matchId });
  };

  const handleTyping = (text: string) => {
    setInput(text);
    socketRef.current?.emit('typing_start', { matchId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', { matchId });
    }, 1500);
  };

  const handleSendImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const formData = new FormData();
        const uri = Platform.OS === 'ios' ? result.assets[0].uri.replace('file://', '') : result.assets[0].uri;
        formData.append('image', {
          uri, name: 'photo.jpg', type: 'image/jpeg',
        } as any);
        await chatAPI.sendImage(matchId, formData);
      } catch (e) {
        Alert.alert('Error', 'Could not send image');
      }
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = (item.sender?._id || item.sender) === user?._id;
    const prevMsg = messages[index - 1];
    const showAvatar = !isMe && (!prevMsg || (prevMsg.sender as any)?._id !== item.sender?._id);

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        {!isMe && (
          <View style={styles.messageAvatarSlot}>
            {showAvatar && (
              <Image
                source={userPhoto ? { uri: userPhoto } : require('../../assets/placeholder.png')}
                style={styles.messageAvatar}
              />
            )}
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {item.type === 'image' && item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.bubbleImage} resizeMode="cover" />
          ) : (
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
          )}
          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
              {formatTime(item.createdAt)}
            </Text>
            {isMe && (
              <Ionicons
                name={item.isRead ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={item.isRead ? '#90E0EF' : 'rgba(255,255,255,0.6)'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => navigation.navigate('UserDetail', { userId })}
        >
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Text>✈️</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{userName}</Text>
            <Text style={[styles.headerStatus, isOnline && styles.headerStatusOnline]}>
              {isTyping ? '✍️ typing...' : isOnline ? '🟢 Online' : 'Offline'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={COLORS.teal} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatEmoji}>✈️</Text>
              <Text style={styles.emptyChatText}>Start planning your adventure!</Text>
            </View>
          }
        />
      )}

      {/* Input area */}
      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.attachBtn} onPress={handleSendImage}>
          <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={input}
          onChangeText={handleTyping}
          multiline
          maxLength={1000}
          placeholderTextColor={COLORS.textLight}
        />
        <TouchableOpacity
          style={[styles.sendBtn, input.trim() ? styles.sendBtnActive : {}]}
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Ionicons name="send" size={20} color={input.trim() ? COLORS.white : COLORS.textLight} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: 10, ...SHADOW.sm,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarPlaceholder: { backgroundColor: COLORS.tealLight, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
  headerStatus: { fontSize: FONTS.xs, color: COLORS.textLight },
  headerStatusOnline: { color: COLORS.success },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: 16, gap: 4, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 4 },
  messageRowMe: { flexDirection: 'row-reverse' },
  messageAvatarSlot: { width: 28, alignItems: 'center' },
  messageAvatar: { width: 28, height: 28, borderRadius: 14 },
  bubble: {
    maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
    ...SHADOW.sm,
  },
  bubbleMe: {
    backgroundColor: COLORS.teal,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: FONTS.base, color: COLORS.text, lineHeight: 20 },
  bubbleTextMe: { color: COLORS.white },
  bubbleImage: { width: 200, height: 200, borderRadius: 12 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, justifyContent: 'flex-end' },
  bubbleTime: { fontSize: 10, color: COLORS.textLight },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  emptyChat: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyChatEmoji: { fontSize: 48 },
  emptyChatText: { fontSize: FONTS.base, color: COLORS.textSecondary },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 24,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    gap: 8,
  },
  attachBtn: { padding: 8 },
  input: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: FONTS.base, color: COLORS.text, maxHeight: 100,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: COLORS.teal },
});
