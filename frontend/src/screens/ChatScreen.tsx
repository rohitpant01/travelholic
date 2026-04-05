import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Pressable,
  PanResponder
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { Socket } from 'socket.io-client';
import { Linking } from 'react-native';
import { chatAPI, tripAPI, userAPI, matchAPI } from '../api/services';
import { RootState } from '../store';
import { setActiveChat, upsertMessage, removeMatch } from '../store/slices/chatSlice';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { API_BASE_URL } from '../api/client';

// Derive socket URL from API base (remove /api path)
const SOCKET_URL = API_BASE_URL.replace('/api', '');

import { useSocket } from '../context/SocketContext';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

interface Reaction {
  user: string;
  emoji: string;
}

interface Message {
  _id: string;
  chatId: string;
  sender: { _id: string; firstName: string; photos?: any[] };
  receiver?: string | { _id: string; firstName: string };
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
  latitude?: number;
  longitude?: number;
  type: 'text' | 'image' | 'voice' | 'location' | 'system';
  isRead?: boolean;
  delivered?: boolean;
  readBy?: string[];
  deliveredTo?: string[];
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  edited?: boolean;
  isDeleted?: boolean;
  reactions?: Reaction[];
  replyTo?: {
    _id: string;
    text?: string;
    imageUrl?: string;
    voiceUrl?: string;
    type: 'text' | 'image' | 'voice' | 'location';
    sender: string | { _id: string; firstName: string };
  };
  createdAt: string;
}

interface MessageItemProps {
  item: Message;
  index: number;
  user: any;
  messages: Message[];
  userName: string;
  userPhoto: string | null;
  chatType: 'individual' | 'group';
  membersCount?: number;
  highlightedMsgId: string | null;
  playingVoiceId: string | null;
  setHighlightedMsgId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedMsg: (msg: Message | null) => void;
  setReplyMsg: (msg: Message | null) => void;
  jumpToMessage: (id: string) => void;
  playVoice: (url: string, id: string) => void;
  setPreviewImage: (url: string) => void;
  handleDelete: (id: string) => void;
  setInput: (text: string) => void;
  setEditingMessageId: (id: string | null) => void;
}

const MessageItem = React.memo(({ 
  item, index, user, messages, userName, userPhoto, chatType, membersCount,
  highlightedMsgId, playingVoiceId, setHighlightedMsgId, 
  setSelectedMsg, setReplyMsg, jumpToMessage, playVoice, 
  setPreviewImage, handleDelete, setInput, setEditingMessageId 
}: MessageItemProps) => {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<any>();
  const swipeableRef = useRef<any>(null);
  const isMe = (item.sender?._id || item.sender) === user?._id;
  const olderMsg = messages[index + 1];
  const newerMsg = messages[index - 1]; 
  const isFirstInGroup = !olderMsg || (olderMsg.sender?._id || olderMsg.sender) !== (item.sender?._id || item.sender) || item.type === 'system';
  const isLastInGroup = !newerMsg || (newerMsg.sender?._id || newerMsg.sender) !== (item.sender?._id || item.sender) || newerMsg.type === 'system';
  const showAvatar = !isMe && isLastInGroup && item.type !== 'system';
  
  const senderPhoto = item.sender?.photos?.find((p: any) => p.isProfile)?.url || item.sender?.photos?.[0]?.url || userPhoto;

  if (item.type === 'system') {
    return (
      <View style={styles.systemMessageContainer}>
        <View style={[styles.systemMessagePill, { backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#f1f5f9' }]}>
          <Text style={[styles.systemMessageText, { color: theme.textSecondary }]}>{item.text}</Text>
        </View>
      </View>
    );
  }

  const renderSwipeActions = () => (
    <View style={styles.swipeAction}>
      <Ionicons name="arrow-undo" size={24} color={theme.teal} />
    </View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={!isMe ? renderSwipeActions : () => null}
      renderRightActions={isMe ? renderSwipeActions : () => null}
      onSwipeableLeftOpen={() => {
        if (!isMe && !item.isDeleted) {
          setReplyMsg(item);
          setTimeout(() => swipeableRef.current?.close(), 10);
        }
      }}
      onSwipeableRightOpen={() => {
        if (isMe && !item.isDeleted) {
          setReplyMsg(item);
          setTimeout(() => swipeableRef.current?.close(), 10);
        }
      }}
      friction={1}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={10}
      rightThreshold={10}
    >
      <View style={[styles.messageRow, isMe && styles.messageRowMe, item._id === highlightedMsgId && styles.highlightedRow]}>
        {!isMe && (
          <View style={styles.messageAvatarSlot}>
            {showAvatar && (
              <TouchableOpacity onPress={() => navigation.navigate('UserDetail', { userId: item.sender?._id || item.sender })}>
                <Image
                  source={senderPhoto ? { uri: senderPhoto } : require('../../assets/placeholder.png')}
                  style={styles.messageAvatar}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setHighlightedMsgId(prev => prev === item._id ? null : item._id)}
          onLongPress={() => setSelectedMsg(item)}
          style={[
            styles.bubble, 
            isMe ? styles.bubbleMe : styles.bubbleThem, 
            item.isDeleted && styles.bubbleDeleted,
            item._id === highlightedMsgId && styles.bubbleHighlighted
          ]}
        >
          {isFirstInGroup && !isMe && chatType === 'group' && (
            <Text style={styles.groupSenderName}>{item.sender?.firstName || 'User'}</Text>
          )}

          {item.replyTo && !item.isDeleted && (
            <TouchableOpacity 
              style={[styles.replyContainer, isMe ? styles.replyContainerMe : styles.replyContainerThem]}
              onPress={() => jumpToMessage(item.replyTo!._id)}
            >
              <View style={[styles.replyBorder, isMe && styles.replyBorderMe]} />
              <View style={styles.replyContent}>
                <Text style={[styles.replySender, isMe ? styles.replySenderMe : styles.replySenderThem]} numberOfLines={1}>
                  {item.replyTo.sender
                    ? (typeof item.replyTo.sender === 'string' 
                        ? (item.replyTo.sender === user?._id ? 'You' : userName)
                        : (item.replyTo.sender._id === user?._id ? 'You' : item.replyTo.sender.firstName))
                    : 'User'}
                </Text>
                <Text style={[styles.replyText, isMe ? styles.replyTextMe : styles.replyTextThem]} numberOfLines={2}>
                  {item.replyTo.type === 'image' ? '📷 Photo' : item.replyTo.type === 'voice' ? '🎤 Voice' : item.replyTo.type === 'location' ? '📍 Location' : item.replyTo.text}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {item.isDeleted ? (
            <Text style={styles.deletedText}>🚫 This message was deleted</Text>
          ) : (
            <>
              {item.type === 'voice' ? (
                <TouchableOpacity onPress={() => playVoice(item.voiceUrl!, item._id)} style={styles.voiceBubble}>
                  <Ionicons name={playingVoiceId === item._id ? "pause" : "play"} size={24} color={isMe ? theme.textWhite : theme.teal} />
                  <View style={styles.voiceWaveform}>
                    {[1,2,3,4,5,6].map(i => <View key={i} style={[styles.waveBar, { height: 4 + Math.random() * 12, backgroundColor: isMe ? "rgba(255,255,255,0.6)" : theme.mode === 'dark' ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }]} />)}
                  </View>
                </TouchableOpacity>
              ) : item.type === 'image' ? (
                <TouchableOpacity onPress={() => setPreviewImage(item.imageUrl!)}>
                  <Image source={{ uri: item.imageUrl }} style={styles.bubbleImage} />
                </TouchableOpacity>
              ) : item.type === 'location' ? (
                <TouchableOpacity
                  onPress={() => {
                    const url = Platform.select({
                      ios: `maps:0,0?q=${item.latitude},${item.longitude}`,
                      android: `geo:0,0?q=${item.latitude},${item.longitude}`,
                    }) || `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
                    Linking.openURL(url);
                  }}
                  style={styles.locationBubble}
                >
                  <MapView
                    style={styles.mapPreview}
                    initialRegion={{
                      latitude: item.latitude!,
                      longitude: item.longitude!,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    liteMode={true}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <Marker coordinate={{ latitude: item.latitude!, longitude: item.longitude! }} />
                  </MapView>
                  <View style={styles.locationInfo}>
                    <Text style={[styles.locationTitle, isMe && styles.locationTitleMe]}>📍 Shared Location</Text>
                    <Text style={[styles.locationSubtitle, isMe && styles.locationSubtitleMe]}>Tap to open in Maps</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
              )}
            </>
          )}

          <View style={[styles.bubbleMeta, isMe && styles.bubbleMetaMe]}>
            {item.edited && !item.isDeleted && <Text style={[styles.editedTag, isMe && styles.editedTagMe]}>(edited)</Text>}
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
             {isMe && !item.isDeleted && (() => {
               const isRead = item.status === 'read' || item.isRead || (chatType === 'group' && item.readBy && item.readBy.length >= Math.max(1, (membersCount || 2) - 1)) || (chatType === 'individual' && item.readBy && item.readBy.length > 0);
               const isDelivered = item.status === 'delivered' || item.delivered || (item.deliveredTo && item.deliveredTo.length > 0) || isRead;
               return (
                 <Ionicons 
                   name={item.status === 'sending' ? "time-outline" : isRead ? "checkmark-done" : isDelivered ? "checkmark-done" : "checkmark"} 
                   size={18} 
                   color={isRead ? "#34B7F1" : "rgba(255,255,255,0.8)"} 
                   style={{ marginLeft: 2, fontWeight: 'bold' }}
                 />
               );
             })()}
          </View>

          {item.reactions && item.reactions.length > 0 && (
            <View style={styles.reactionContainer}>
              {item.reactions.map((r, i) => <Text key={i} style={styles.reactionEmoji}>{r.emoji}</Text>)}
            </View>
          )}
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
}, (prev, next) => {
  return prev.item._id === next.item._id && 
         prev.item.status === next.item.status && 
         prev.item.isRead === next.item.isRead &&
         prev.item.readBy?.length === next.item.readBy?.length &&
         prev.item.deliveredTo?.length === next.item.deliveredTo?.length &&
         prev.item.edited === next.item.edited &&
         prev.item.reactions?.length === next.item.reactions?.length &&
         prev.highlightedMsgId === next.highlightedMsgId &&
         prev.playingVoiceId === next.playingVoiceId;
});

const formatLastSeen = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return 'Last seen just now';
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
  return `Last seen on ${d.toLocaleDateString()}`;
};

export default function ChatScreen() {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { 
    type, chatId, userName, userPhoto, userId, 
    membersCount: routeMembersCount, 
    isOnline: initialOnline, 
    activityStatus: initialActivity, 
    lastSeen: initialLastSeen 
  } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch();

  const [activeUserName, setActiveUserName] = useState(userName);
  const [activeUserPhoto, setActiveUserPhoto] = useState(userPhoto);

  useEffect(() => {
    setActiveUserName(userName);
    setActiveUserPhoto(userPhoto);
  }, [userName, userPhoto]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [membersCount, setMembersCount] = useState<number>(routeMembersCount || 2);
  const [isOnline, setIsOnline] = useState(!!initialOnline);
  const [activityStatus, setActivityStatus] = useState<string | null>(initialActivity || 'Online');
  const [lastSeen, setLastSeen] = useState<string | null>(initialLastSeen || null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  // Viewability Config for Read Detection
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (!viewableItems.length || !user?._id) return;
    const currentUserId = String(user._id);

    viewableItems.forEach(({ item }: any) => {
      // In group chat, anyone who isn't me
      const isMe = (item.sender?._id || item.sender) === currentUserId;
      if (!isMe && !item.isRead && !item.isDeleted && item.type !== 'system') {
        const alreadyReadByMe = item.readBy?.some((uid: string) => String(uid) === currentUserId);
        if (!alreadyReadByMe) {
          socketRef.current?.emit('message_seen', { 
            messageId: item._id, 
            chatId, 
            chatType: type 
          });
          // Optimistically update local state to avoid spamming emits
          setMessages(prev => prev.map(m => 
            m._id === item._id ? { ...m, readBy: [...(m.readBy || []), currentUserId] } : m
          ));
        }
      }
    });
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 40 // 40% visibility marks as read
  }).current;
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [replyMsg, setReplyMsg] = useState<Message | null>(null);
  
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isPressingVoice = useRef(false);
  const isCancelledRef = useRef(false);
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  const { socket: globalSocket } = useSocket();
  const socketRef = useRef<Socket | null>(null);

  // Keep socketRef in sync with the global socket
  useEffect(() => {
    socketRef.current = globalSocket;
  }, [globalSocket]);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<any>(null);
  const isNavigating = useRef(false);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [downloading, setDownloading] = useState(false);

  const handleDownloadImage = async (url: string | null) => {
    if (!url) return;
    try {
      setDownloading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need permission to save images to your gallery.');
        return;
      }

      // 1. Download to local cache
      const filename = url.split('/').pop()?.split('?')[0] || `ekalgo_${Date.now()}.jpg`;
      const fileUri = cacheDirectory + (filename.includes('.') ? filename : `${filename}.jpg`);
      
      const downloadRes = await downloadAsync(url, fileUri);
      
      if (downloadRes.status === 200) {
        // 2. Save to gallery
        await MediaLibrary.createAssetAsync(downloadRes.uri);
        Alert.alert('Saved!', 'Image has been saved to your photo gallery 📸');
      } else {
        throw new Error('Download failed');
      }
    } catch (e) {
      console.error('Download error:', e);
      Alert.alert('Oops', 'Failed to save image. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const loadMessages = async () => {
    if (!chatId || String(chatId) === 'undefined' || String(chatId) === 'null') {
      console.log('[ChatScreen] No chatId provided. Skipping loadMessages.');
      setLoading(false);
      return;
    }

    try {
      console.log(`[ChatScreen] Loading messages for ${type}: ${chatId}`);
      const res = type === 'group' 
        ? await tripAPI.getTripMessages(chatId)
        : await chatAPI.getMessages(chatId);
      
      if (type === 'group') {
        tripAPI.getTrip(chatId).then(detailsRes => {
          const trip = detailsRes.data.trip;
          const name = trip.groupName || `${trip.source?.city} → ${trip.destination?.city}`;
          setActiveUserName(name);
          setActiveUserPhoto(trip.groupIcon);
        }).catch(() => {});
      }
      // Backend returns [oldest ... newest]. We store [newest ... oldest] for inverted FlatList.
      setMessages(res.data.messages.reverse());
    } catch (e) {
      console.error('[ChatScreen] loadMessages error:', e);
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const sock = globalSocket;
    if (!sock || !chatId) return;

    // Join this specific chat room
    sock.emit('join_chat', { chatId, chatType: type });

    const onReceiveMessage = (msg: Message) => {
      const isForThisChat =
        String(msg.chatId) === String(chatId) ||
        (msg as any).trip === chatId ||           // group messages
        (msg as any).matchId === chatId;          // individual messages

      if (!isForThisChat) return;

      setMessages(prev => {
        const alreadyExists = prev.find(m => m._id === msg._id);
        if (alreadyExists) return prev;

        const isMe = (msg.sender?._id || (msg.sender as any)) === user?._id;
        if (isMe) {
          // Replace optimistic temp message
          const filtered = prev.filter(m => {
            if (m._id.startsWith('temp-') && m.type === 'text' && msg.type === 'text' && m.text === msg.text) return false;
            if (m._id.startsWith('temp-') && (msg.type === 'image' || msg.type === 'voice' || msg.type === 'location') && m.type === msg.type) return false;
            return true;
          });
          return [msg, ...filtered];
        }
        return [msg, ...prev];
      });

      setTimeout(() => {
        if (!isNavigating.current) flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);

      const senderId = String(msg.sender?._id || msg.sender);
      if (senderId !== String(userRef.current?._id)) {
        sock.emit('message_seen', { messageId: msg._id, chatId, chatType: type });
      }
    };

    const onMessageStatusUpdate = ({ messageId, status: newStatus, chatId: mid, readBy, deliveredTo }: any) => {
      if (String(mid) !== String(chatId)) return;
      setMessages(prev => {
        if (messageId) {
          return prev.map(m => m._id === messageId ? {
            ...m,
            status: newStatus || m.status,
            isRead: newStatus === 'read' ? true : m.isRead,
            readBy: readBy || m.readBy,
            deliveredTo: deliveredTo || m.deliveredTo,
          } : m);
        }
        const currentUserId = String(userRef.current?._id);
        return prev.map(m => {
          const senderId = String(m.sender?._id || m.sender);
          if (senderId === currentUserId) return { ...m, status: newStatus, isRead: newStatus === 'read' || m.isRead };
          return m;
        });
      });
    };

    const onMessageEdited = (msg: Message) => {
      setMessages(prev => prev.map(m => m._id === msg._id ? msg : m));
    };

    const onMessageDeleted = ({ messageId }: any) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId
          ? { ...m, isDeleted: true, text: 'This message was deleted', imageUrl: undefined, voiceUrl: undefined }
          : m
      ));
    };

    const onMessageReacted = ({ messageId, reactions }: any) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
    };

    const onMemberRemoved = ({ userId: rid, tripId: tid }: any) => {
      if (String(tid) === String(chatId)) {
        if (String(rid) === String(user?._id)) {
          Alert.alert('Group Update', 'You have been removed from this group.');
          navigation.navigate('Matches');
        }
      }
    };

    const onTyping = ({ from, isTyping: typing, senderName }: any) => {
      if (from !== user?._id) {
        setTypingUsers(prev => {
          const next = { ...prev };
          if (typing) next[from] = senderName || 'Someone';
          else delete next[from];
          return next;
        });
      }
    };

    const onGroupInfoUpdated = ({ chatId: mid, groupName, groupIcon }: any) => {
      if (String(mid) === String(chatId)) {
        if (groupName) setActiveUserName(groupName);
        if (groupIcon) setActiveUserPhoto(groupIcon);
      }
    };

    const onMessagesReadAck = ({ readBy, chatId: mid }: any) => {
      const currentUserId = String(userRef.current?._id);
      if (String(readBy) !== currentUserId && String(mid) === String(chatId)) {
        setMessages(prev => prev.map(m => {
          const senderId = String(m.sender?._id || m.sender);
          if (senderId === currentUserId) return { ...m, status: 'read', isRead: true };
          return m;
        }));
      }
    };

    const onUserOnlineStatus = ({ userId: uid, isOnline: online, activityStatus: status, lastSeen: seen }: any) => {
      if (uid === userId) {
        setIsOnline(online);
        if (status) setActivityStatus(status);
        if (seen) setLastSeen(seen);
      }
    };

    sock.on('receive_message', onReceiveMessage);
    sock.on('message_status_update', onMessageStatusUpdate);
    sock.on('message_edited', onMessageEdited);
    sock.on('message_deleted', onMessageDeleted);
    sock.on('message_reacted', onMessageReacted);
    sock.on('member_removed', onMemberRemoved);
    sock.on('typing', onTyping);
    sock.on('group_info_updated', onGroupInfoUpdated);
    sock.on('messages_read_ack', onMessagesReadAck);
    sock.on('user_online', onUserOnlineStatus);

    return () => {
      sock.emit('leave_chat', { chatId, chatType: type });
      sock.off('receive_message', onReceiveMessage);
      sock.off('message_status_update', onMessageStatusUpdate);
      sock.off('message_edited', onMessageEdited);
      sock.off('message_deleted', onMessageDeleted);
      sock.off('message_reacted', onMessageReacted);
      sock.off('member_removed', onMemberRemoved);
      sock.off('typing', onTyping);
      sock.off('group_info_updated', onGroupInfoUpdated);
      sock.off('messages_read_ack', onMessagesReadAck);
      sock.off('user_online', onUserOnlineStatus);
    };
  }, [globalSocket, chatId, type, userId, user?._id]);

  useEffect(() => {
    dispatch(setActiveChat(chatId));
    loadMessages();

    // Proactive Audio Setup
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(e => console.warn('Audio initial setup failed', e));

    return () => {
      dispatch(setActiveChat(null));
      if (soundRef.current) soundRef.current.unloadAsync();
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
    };
  }, [chatId]); // chatId dependency to update active state safely

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity 
          style={styles.headerTitleContainer}
          onPress={() => {
            if (type === 'individual') navigation.navigate('UserDetail', { userId });
            else if (type === 'group') navigation.navigate('GroupDetails', { tripId: chatId });
          }}
        >
          {activeUserPhoto ? (
            <Image source={{ uri: activeUserPhoto }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: theme.tealLight, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person" size={20} color={theme.teal} />
            </View>
          )}
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{activeUserName}</Text>
            {type === 'individual' && (
              <Text style={[styles.headerStatus, { color: isOnline ? theme.success : theme.textSecondary }]}>
                {isOnline ? (activityStatus || 'Online') : formatLastSeen(lastSeen)}
              </Text>
            )}
            {type === 'group' && (
              <Text style={styles.headerStatus}>{membersCount} members</Text>
            )}
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
          <TouchableOpacity 
            style={{ padding: 8 }} 
            onPress={() => setIsOptionsModalVisible(true)}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      )
    });
  }, [navigation, theme, activeUserName, activeUserPhoto, isOnline, activityStatus, lastSeen, membersCount]);



  // 7️⃣ Granular Read Receipt Trigger (Now handled by onViewableItemsChanged)
  /*
  useEffect(() => {
    ... 
  }, [messages, user?._id]);
  */

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    if (editingMessageId) {
      const originalText = messages.find(m => m._id === editingMessageId)?.text || '';
      
      // Optimistic Update
      setMessages(prev => prev.map(m => 
        m._id === editingMessageId ? { ...m, text, edited: true } : m
      ));
      
      try {
        if (type === 'group') {
          await tripAPI.editTripMessage(chatId, editingMessageId, text);
        } else {
          await chatAPI.editMessage(editingMessageId, text);
        }
        setEditingMessageId(null);
        setSelectedMsg(null);
      } catch (e) { 
        // Rollback on error
        setMessages(prev => prev.map(m => 
          m._id === editingMessageId ? { ...m, text: originalText, edited: false } : m
        ));
        Alert.alert('Error', 'Could not edit message'); 
      }
    } else {
      socketRef.current?.emit('send_message', { 
        chatId, 
        chatType: type,
        receiverId: userId, 
        text,
        replyTo: replyMsg?._id 
      });

      // Optimistic Update: Add message immediately
      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: any = {
        _id: tempId,
        chatId,
        sender: { _id: user?._id, firstName: 'You' },
        receiver: userId,
        text,
        type: 'text',
        createdAt: new Date().toISOString(),
        replyTo: replyMsg ? { ...replyMsg } : null,
        status: 'sending',
        delivered: false,
        isRead: false
      };
      
      setMessages(prev => [optimisticMsg, ...prev]);
      setReplyMsg(null);
      
      // Auto-scroll to bottom after sending
      setTimeout(() => {
        isNavigating.current = false; // Reset if it was set
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
    socketRef.current?.emit('typing', { from: user?._id, to: userId, isTyping: false, chatId, chatType: type });
    setEditingMessageId(null); // Ensure state reset
  };

  const startRecording = async () => {
    try {
      isPressingVoice.current = true;
      
      // 1. Rigorous Cleanup
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {}
        recordingRef.current = null;
        setRecording(null);
      }

      // 2. Permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        isPressingVoice.current = false;
        Alert.alert('Permission Required', 'EkalGo needs microphone access to send voice messages.');
        return;
      }

      // 3. Audio Mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });

      // 4. Create & Prepare (Manual Flow)
      const recordingInstance = new Audio.Recording();
      await recordingInstance.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      
      // Check if user released while preparing
      if (!isPressingVoice.current) {
        await recordingInstance.stopAndUnloadAsync().catch(() => {});
        return;
      }

      await recordingInstance.startAsync();
      recordingRef.current = recordingInstance;
      setRecording(recordingInstance);
      setIsRecording(true);

    } catch (err) { 
      isPressingVoice.current = false;
      console.error('Recording failed to start:', err);
      Alert.alert('Error', 'Could not start recording. Please try again.'); 
      
      // Ensure cleanup on failure
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    }
  };

  const stopRecording = async (cancel = false) => {
    isPressingVoice.current = false;
    setIsRecording(false);
    setIsCancelled(false);
    const rec = recordingRef.current;
    if (!rec) return;

    try {
      recordingRef.current = null;
      setRecording(null);
      await rec.stopAndUnloadAsync();
      
      if (cancel) {
        console.log('[VOICE] Recording cancelled by user gesture');
        return;
      }

      const uri = rec.getURI();
      if (uri) uploadVoice(uri);
    } catch (err) { 
      console.warn('Stop recording failed', err); 
    }
  };

  // ----------------------------------------------------------------
  // GESTURE HANDLER (SWIPE TO CANCEL)
  // ----------------------------------------------------------------
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isCancelledRef.current = false;
        setIsCancelled(false);
        startRecording();
      },
      onPanResponderMove: (_, gestureState) => {
        // If swiped left more than 60 pixels
        if (gestureState.dx < -60) {
          if (!isCancelledRef.current) {
            isCancelledRef.current = true;
            setIsCancelled(true);
          }
        } else {
          if (isCancelledRef.current) {
            isCancelledRef.current = false;
            setIsCancelled(false);
          }
        }
      },
      onPanResponderRelease: () => {
        stopRecording(isCancelledRef.current);
      },
      onPanResponderTerminate: () => {
        stopRecording(true); // Cancel on interruption (e.g. phone call)
      }
    })
  ).current;

  const uploadVoice = async (uri: string) => {
    const tempId = `temp-voice-${Date.now()}`;
    const optimisticMsg: any = {
      _id: tempId,
      chatId,
      sender: { _id: user?._id, firstName: 'You' },
      receiver: userId,
      voiceUrl: uri,
      type: 'voice',
      createdAt: new Date().toISOString(),
      status: 'sending',
      delivered: false,
      isRead: false
    };
    setMessages(prev => [optimisticMsg, ...prev]);

    try {
      const audioObj = { 
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''), 
        name: `voice-${Date.now()}.m4a`, 
        type: 'audio/m4a' 
      };
      const res = type === 'group' 
        ? await tripAPI.sendTripVoice(chatId, audioObj, tempId, replyMsg?._id)
        : await chatAPI.sendVoice(chatId, audioObj, replyMsg?._id);
      
      if (res.data && res.data.message) {
        setMessages(prev => {
          const socketAdded = prev.find(m => m._id === res.data.message._id);
          if (socketAdded) return prev.filter(m => m._id !== tempId);
          return prev.map(m => m._id === tempId ? res.data.message : m);
        });
        if (user?._id) {
          dispatch(upsertMessage({ message: res.data.message, currentUserId: user._id }));
        }
      }
    } catch (e) { 
      Alert.alert('Error', 'Could not send voice message'); 
      setMessages(prev => prev.filter(m => m._id !== tempId));
    }
  };

  const playVoice = async (url: string, id: string) => {
    if (playingVoiceId === id) {
      await soundRef.current?.pauseAsync();
      setPlayingVoiceId(null);
      return;
    }
    if (soundRef.current) await soundRef.current.unloadAsync();
    const { sound } = await Audio.Sound.createAsync({ uri: url });
    soundRef.current = sound;
    setPlayingVoiceId(id);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) setPlayingVoiceId(null);
    });
  };

  const handleDelete = async (msgId: string) => {
    try {
      if (type === 'group') {
        await tripAPI.deleteTripMessage(chatId, msgId);
      } else {
        await chatAPI.deleteMessage(msgId);
      }
      socketRef.current?.emit('delete_message', { messageId: msgId, chatId, chatType: type });
      setSelectedMsg(null);
    } catch (e) { Alert.alert('Error', 'Delete failed'); }
  };

  const handleReact = async (msgId: string, emoji: string | null) => {
    try {
      if (type === 'group') {
        await tripAPI.reactTripMessage(chatId, msgId, emoji || '');
      } else {
        await chatAPI.reactToMessage(msgId, emoji);
      }
      // Removed redundant socket emit: backend now broadcasts 'message_reacted'
      setSelectedMsg(null);
    } catch (e) {}
  };

  const handleTyping = (text: string) => {
    setInput(text);
    socketRef.current?.emit('typing', { from: user?._id, to: userId, isTyping: true, chatId, chatType: type });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit('typing', { from: user?._id, to: userId, isTyping: false, chatId, chatType: type });
    }, 1500);
  };

  const jumpToMessage = (id: string) => {
    const idx = messages.findIndex(m => m._id === id);
    if (idx !== -1) {
      isNavigating.current = true;
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      setHighlightedMsgId(id);
      
      // Release the navigation lock after a delay
      setTimeout(() => {
        isNavigating.current = false;
      }, 3000);

      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  const handleSendImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.8 
    });
    
    if (!result.canceled && result.assets[0]) {
      const originalUri = result.assets[0].uri;
      
      // Perform image manipulation: Resize to max 1024px width and compress
      // This significantly reduces upload time without meaningful quality loss for mobile chat
      const manipulated = await ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const uri = Platform.OS === 'ios' ? manipulated.uri.replace('file://', '') : manipulated.uri;
      const tempId = `temp-img-${Date.now()}`;
      const optimisticMsg: any = {
        _id: tempId,
        chatId,
        sender: { _id: user?._id, firstName: 'You' },
        receiver: userId,
        imageUrl: uri,
        type: 'image',
        createdAt: new Date().toISOString(),
        status: 'sending',
        delivered: false,
        isRead: false
      };
      setMessages(prev => [optimisticMsg, ...prev]);

      try {
        const imgObj = { 
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''), 
          name: `upload-${Date.now()}.jpg`, 
          type: 'image/jpeg' 
        };
        const res = type === 'group' 
          ? await tripAPI.sendTripMedia(chatId, imgObj, tempId, replyMsg?._id)
          : await chatAPI.sendImage(chatId, imgObj, replyMsg?._id);
        
        if (res.data && res.data.message) {
          setMessages(prev => {
            const socketAdded = prev.find(m => m._id === res.data.message._id);
            if (socketAdded) return prev.filter(m => m._id !== tempId);
            return prev.map(m => m._id === tempId ? res.data.message : m);
          });
          if (user?._id) {
            dispatch(upsertMessage({ message: res.data.message, currentUserId: user._id }));
          }
        }
      } catch (e) { 
        Alert.alert('Error', 'Upload failed'); 
        setMessages(prev => prev.filter(m => m._id !== tempId));
      }
    }
  };
  
  const handleSendLocation = async () => {
    if (isLocationLoading) return;
    setIsLocationLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to share your location.');
        setIsLocationLoading(false);
        return;
      }

      let location = null;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (err) {
        console.warn('❌ [ChatScreen] getCurrentPositionAsync failed, trying getLastKnownPositionAsync:', err.message);
        location = await Location.getLastKnownPositionAsync();
      }

      if (!location) {
        Alert.alert('Location Error', 'Current location is unavailable. Make sure that location services are enabled');
        setIsLocationLoading(false);
        return;
      }

      const { latitude, longitude } = location.coords;
      const tempId = `temp-loc-${Date.now()}`;
      
      socketRef.current?.emit('send_message', {
        chatId,
        chatType: type,
        receiverId: userId,
        latitude,
        longitude,
        type: 'location',
        replyTo: replyMsg?._id,
        tempId
      });

      // Optimistic Update
      const optimisticMsg: any = {
        _id: tempId,
        chatId,
        sender: { _id: user?._id, firstName: 'You' },
        receiver: userId,
        latitude,
        longitude,
        type: 'location',
        createdAt: new Date().toISOString(),
        status: 'sending',
        delivered: false,
        isRead: false
      };
      setMessages(prev => [optimisticMsg, ...prev]);
      setReplyMsg(null);
      
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);

    } catch (error) {
      console.error('Error sending location:', error);
      Alert.alert('Error', 'Could not get your current location. Please check your settings.');
    } finally {
      setIsLocationLoading(false);
    }
  };

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => (
    <MessageItem 
      item={item}
      index={index}
      user={user}
      messages={messages}
      userName={activeUserName}
      userPhoto={activeUserPhoto}
      chatType={type}
      membersCount={membersCount}
      highlightedMsgId={highlightedMsgId}
      playingVoiceId={playingVoiceId}
      setHighlightedMsgId={setHighlightedMsgId}
      setSelectedMsg={setSelectedMsg}
      setReplyMsg={setReplyMsg}
      jumpToMessage={jumpToMessage}
      playVoice={playVoice}
      setPreviewImage={setPreviewImage}
      handleDelete={handleDelete}
      setInput={setInput}
      setEditingMessageId={setEditingMessageId}
    />
  ), [messages, playingVoiceId, user, highlightedMsgId, activeUserName, activeUserPhoto, setSelectedMsg, setReplyMsg, jumpToMessage, playVoice, setPreviewImage, handleDelete, setInput, setEditingMessageId]);

  // --- SAFETY & OPTIONS HANDLERS ---

  const handleBlock = () => {
    setIsOptionsModalVisible(false);
    Alert.alert(
      "Block User?",
      `Are you sure you want to block ${activeUserName}? They will no longer be able to message you.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Block", 
          style: "destructive",
          onPress: async () => {
            try {
              await userAPI.blockUser(userId);
              navigation.goBack();
            } catch (e) {
              Alert.alert("Error", "Failed to block user.");
            }
          }
        }
      ]
    );
  };

  const handleReport = () => {
    setIsReporting(true);
  };

  const handleLeaveGroup = () => {
    setIsOptionsModalVisible(false);
    Alert.alert(
      "Leave Group?",
      "Are you sure you want to leave this group? You will no longer receive messages.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Leave", 
          style: "destructive",
          onPress: async () => {
            try {
              if (user?._id) {
                await tripAPI.leaveTrip(chatId, user._id);
                navigation.goBack();
              }
            } catch (e) {
              Alert.alert("Error", "Failed to leave group.");
            }
          }
        }
      ]
    );
  };

  const submitReport = async (reason: string) => {
    try {
      if (type === 'group') {
        await tripAPI.reportTrip(chatId, { reason });
      } else {
        await userAPI.reportUser({ targetUserId: userId || chatId, reason, matchId: chatId });
      }
      
      // 2. Local State Sync: Instantly remove from Matches list
      dispatch(removeMatch(chatId));

      setIsReporting(false);
      setIsOptionsModalVisible(false);
      
      Alert.alert(
        "Report Submitted ✅",
        "Thank you for helping keep EkalGo safe. This chat has been removed and blocked for your safety.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert("Error", "Failed to submit report. Please try again.");
    }
  };

  const handleClearChat = () => {
    setIsOptionsModalVisible(false);
    Alert.alert(
      "Clear Chat?",
      "This will permanently delete all messages in this conversation. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive",
          onPress: async () => {
            try {
              await chatAPI.clearChat(chatId);
              setMessages([]);
            } catch (e) {
              Alert.alert("Error", "Failed to clear chat.");
            }
          }
        }
      ]
    );
  };

  const handleMute = async () => {
    try {
      if (type === 'group') await tripAPI.muteTrip(chatId);
      else await matchAPI.muteMatch(chatId);
      Alert.alert("Muted", "Notifications for this chat have been muted.");
      setIsOptionsModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Failed to mute chat.");
    }
  };

  const renderOptionsModal = () => (
    <Modal
      visible={isOptionsModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setIsOptionsModalVisible(false);
        setIsReporting(false);
      }}
    >
      <Pressable 
        style={styles.optionsModalOverlay} 
        onPress={() => {
          setIsOptionsModalVisible(false);
          setIsReporting(false);
        }}
      >
        <View style={styles.optionsModalContent}>
          <View style={styles.optionsModalHandle} />
          
          {isReporting ? (
            <View style={{ paddingBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity onPress={() => setIsReporting(false)} style={{ padding: 5 }}>
                  <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.optionsText, { marginLeft: 15 }]}>Report {type === 'group' ? 'Group' : 'User'}</Text>
              </View>
              
              <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 15 }}>
                Select a reason for reporting this {type === 'group' ? 'group' : 'user'}:
              </Text>

               {(() => {
                 const reasons = type === 'group' 
                   ? ['Spam / Promotion Group', 'Scam / Fraud Activity', 'Inappropriate Group Content', 'Toxic / Abusive Conversations', 'Misleading Travel Information', 'Safety Risk']
                   : ['Fake Profile', 'Harassment', 'Spam', 'Inappropriate Behavior', 'Safety Concern'];
                 
                 return reasons.map(reason => (
                   <TouchableOpacity 
                     key={reason} 
                     style={styles.optionsItem} 
                     onPress={() => submitReport(reason)}
                   >
                     <Text style={styles.optionsText}>{reason}</Text>
                     <Ionicons name="chevron-forward" size={20} color={theme.border} style={{ marginLeft: 'auto' }} />
                   </TouchableOpacity>
                 ));
               })()}
            </View>
          ) : (
            <>
              {type === 'group' ? (
                <>
                  <TouchableOpacity 
                    style={styles.optionsItem}
                    onPress={() => {
                      setIsOptionsModalVisible(false);
                      navigation.navigate('GroupDetails', { tripId: chatId });
                    }}
                  >
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="people-outline" size={20} color={theme.text} />
                    </View>
                    <Text style={styles.optionsText}>View Members</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.optionsItem} onPress={handleMute}>
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="notifications-off-outline" size={20} color={theme.text} />
                    </View>
                    <Text style={styles.optionsText}>Mute Notifications</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optionsItem} onPress={handleClearChat}>
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="trash-outline" size={20} color={theme.text} />
                    </View>
                    <Text style={styles.optionsText}>Clear Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optionsItem} onPress={handleReport}>
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="warning-outline" size={20} color={theme.error} />
                    </View>
                    <Text style={[styles.optionsText, styles.optionsTextDestructive]}>Report Group</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.optionsItem, { borderBottomWidth: 0 }]} onPress={handleLeaveGroup}>
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="log-out-outline" size={20} color={theme.error} />
                    </View>
                    <Text style={[styles.optionsText, styles.optionsTextDestructive]}>Leave Group</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.optionsItem}
                    onPress={() => {
                      setIsOptionsModalVisible(false);
                      navigation.navigate('UserDetail', { userId });
                    }}
                  >
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="person-outline" size={20} color={theme.text} />
                    </View>
                    <Text style={styles.optionsText}>View Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optionsItem} onPress={handleMute}>
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="notifications-off-outline" size={20} color={theme.text} />
                    </View>
                    <Text style={styles.optionsText}>Mute Notifications</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optionsItem} onPress={handleClearChat}>
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="trash-outline" size={20} color={theme.text} />
                    </View>
                    <Text style={styles.optionsText}>Clear Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.optionsItem}
                    onPress={() => {
                      setIsOptionsModalVisible(false);
                      Alert.alert("Travel Safe ✨", "1. Share your live location with family.\n2. Meet in public places.\n3. Verify your companion's profile photo.\n4. Trust your instincts!", [{ text: "Got it!" }]);
                    }}
                  >
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="shield-checkmark-outline" size={20} color={theme.teal} />
                    </View>
                    <Text style={[styles.optionsText, { color: theme.teal }]}>Safety Tips</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optionsItem} onPress={handleReport}>
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="warning-outline" size={20} color={theme.error} />
                    </View>
                    <Text style={[styles.optionsText, styles.optionsTextDestructive]}>Report User</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.optionsItem, { borderBottomWidth: 0 }]} onPress={handleBlock}>
                    <View style={styles.optionsIconContainer}>
                      <Ionicons name="ban-outline" size={20} color={theme.error} />
                    </View>
                    <Text style={[styles.optionsText, styles.optionsTextDestructive]}>Block User</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={'padding'} 
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
    >

      <FlatList 
        ref={flatListRef} 
        data={messages} 
        renderItem={renderMessage} 
        keyExtractor={item => item._id} 
        inverted 
        contentContainerStyle={styles.messagesList}
        extraData={messages}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={false}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 100));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
          });
        }}
        ListEmptyComponent={<View style={styles.emptyChat}><Text style={styles.emptyChatEmoji}>✈️</Text><Text>Start your adventure!</Text></View>}
      />

      {/* Image Preview Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPreviewImage(null)}>
          <Image source={{ uri: previewImage! }} style={styles.fullImage} resizeMode="contain" />

          <View style={[styles.previewControls, { top: Math.max(insets.top, 20) + 10 }]}>
            <TouchableOpacity
              style={styles.previewIconBtn}
              onPress={() => handleDownloadImage(previewImage)}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download" size={24} color="#fff" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.previewIconBtn}
              onPress={() => setPreviewImage(null)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {replyMsg && (
        <View style={styles.replyPreviewWrapper}>
          <TouchableOpacity
            style={styles.replyPreviewContent}
            onPress={() => jumpToMessage(replyMsg._id)}
          >
            <Text style={styles.replyPreviewSender}>Replying to {(replyMsg.sender?._id || replyMsg.sender) === user?._id ? 'yourself' : userName}</Text>
            <Text style={{ color: theme.textSecondary }} numberOfLines={1}>{replyMsg.text || (replyMsg.type === 'image' ? 'Photo' : replyMsg.type === 'voice' ? 'Voice' : replyMsg.type === 'location' ? 'Location' : '')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setReplyMsg(null)}><Ionicons name="close-circle" size={24} color={theme.textSecondary} /></TouchableOpacity>
        </View>
      )}

      {editingMessageId && (
        <View style={styles.editBar}><Text style={styles.editText}>Editing Message</Text><TouchableOpacity onPress={() => { setEditingMessageId(null); setInput(''); }}><Text style={styles.editCancel}>Cancel</Text></TouchableOpacity></View>
      )}

      <View style={styles.inputArea}>
        <View style={styles.inputMainContainer}>
          {isRecording ? (
            <View style={[styles.recordingArea, isCancelled && styles.recordingAreaCancelled]}>
              <View style={[styles.recordingDot, isCancelled && styles.recordingDotCancelled]} />
              <Text style={styles.recordingText}>
                {isCancelled ? 'Release to Cancel' : 'Recording Voice...'}
              </Text>
              {!isCancelled && <Text style={styles.recordingHint}>← Slide to cancel</Text>}
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.attachBtn} onPress={handleSendImage}>
                <Ionicons name="image-outline" size={26} color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.attachBtn, isLocationLoading && { opacity: 0.5 }]} 
                onPress={handleSendLocation}
                disabled={isLocationLoading}
              >
                {isLocationLoading ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Ionicons name="location-outline" size={26} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
              <TextInput 
                style={styles.input} 
                placeholder="Type message..." 
                placeholderTextColor={theme.textSecondary}
                value={input} 
                onChangeText={handleTyping} 
                multiline 
              />
            </>
          )}
        </View>

        {input.trim() && !isRecording ? (
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={20} color={theme.textWhite} />
          </TouchableOpacity>
        ) : (
          <View 
            style={[styles.voiceBtn, isRecording && (isCancelled ? styles.voiceBtnCancelled : styles.voiceBtnActive)]} 
            {...panResponder.panHandlers}
          >
            <Ionicons name={isRecording ? (isCancelled ? "trash" : "mic-off") : "mic"} size={24} color={isRecording ? theme.textWhite : theme.teal} />
          </View>
        )}
      </View>

      {/* Context Menu Modal */}
      <Modal visible={!!selectedMsg} transparent animationType="fade" onRequestClose={() => setSelectedMsg(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedMsg(null)}>
          <View style={styles.modalContent}>
            <View style={styles.reactionPicker}>
              {REACTION_EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => handleReact(selectedMsg!._id, e)}><Text style={styles.pickerEmoji}>{e}</Text></TouchableOpacity>
              ))}
            </View>
            <View style={styles.actionList}>
              <TouchableOpacity style={styles.actionItem} onPress={() => { setReplyMsg(selectedMsg); setSelectedMsg(null); }}>
                <Ionicons name="arrow-undo" size={20} color={theme.text} /><Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
              {selectedMsg?.sender?._id === user?._id && !selectedMsg.isDeleted && (
                <>
                  {selectedMsg.type === 'text' && (
                    <TouchableOpacity style={styles.actionItem} onPress={() => { setInput(selectedMsg.text || ''); setEditingMessageId(selectedMsg._id); setSelectedMsg(null); }}>
                      <Ionicons name="create-outline" size={20} color={theme.text} /><Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionItem} onPress={() => handleDelete(selectedMsg._id)}>
                    <Ionicons name="trash-outline" size={20} color={theme.error} /><Text style={[styles.actionText, { color: theme.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {renderOptionsModal()}
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: theme.white, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12, ...SHADOW.sm
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerName: { fontSize: 16, fontWeight: '700', color: theme.text },
  headerStatus: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  headerStatusOnline: { color: theme.success },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12, width: '100%' },
  messageRowMe: { flexDirection: 'row-reverse' },
  highlightedRow: { backgroundColor: theme.mode === 'dark' ? 'rgba(0, 180, 255, 0.15)' : 'rgba(0, 150, 255, 0.1)', marginHorizontal: -16, paddingHorizontal: 16 },
  messageAvatarSlot: { width: 28 },
  messageAvatar: { width: 28, height: 28, borderRadius: 14 },
  bubble: { maxWidth: '75%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, ...SHADOW.sm },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: theme.teal, borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: theme.card, borderBottomLeftRadius: 4 },
  bubbleHighlighted: { backgroundColor: theme.mode === 'dark' ? 'rgba(0, 180, 255, 0.1)' : 'rgba(0, 150, 255, 0.05)' },
  groupSenderName: { fontSize: 12, fontWeight: '800', color: theme.teal, marginBottom: 2 },
  bubbleText: { fontSize: 15, color: theme.text, lineHeight: 22, flexShrink: 1 },
  bubbleTextMe: { color: theme.textWhite },
  bubbleImage: { width: 220, height: 220, borderRadius: 12 },
  locationBubble: { width: 220, overflow: 'hidden' },
  mapPreview: { width: 220, height: 120, borderRadius: 8 },
  locationInfo: { padding: 8 },
  locationTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
  locationTitleMe: { color: theme.textWhite },
  locationSubtitle: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  locationSubtitleMe: { color: 'rgba(255,255,255,0.8)' },
  bubbleDeleted: { backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#F1F5F9', borderStyle: 'dashed', borderWidth: 1, borderColor: theme.border },
  deletedText: { fontStyle: 'italic', color: theme.textSecondary, fontSize: 13 },
  voiceBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160 },
  voiceWaveform: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 24, flex: 1 },
  waveBar: { width: 3, borderRadius: 2 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  bubbleMetaMe: { justifyContent: 'flex-end' },
  bubbleTime: { fontSize: 10, color: theme.textSecondary },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  editedTag: { fontSize: 10, color: theme.textSecondary, fontStyle: 'italic', marginRight: 4 },
  editedTagMe: { color: 'rgba(255,255,255,0.7)' },
  systemMessageContainer: { alignItems: 'center', marginVertical: 12 },
  systemMessagePill: { backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#f1f5f9', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  systemMessageText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500', textAlign: 'center' },
  tickContainer: { marginLeft: 2 },
  swipeAction: { width: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  reactionContainer: { position: 'absolute', bottom: -12, right: 10, flexDirection: 'row', backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: theme.border, ...SHADOW.sm },
  reactionEmoji: { fontSize: 12, marginHorizontal: 1 },
  replyContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', padding: 6, marginBottom: 6, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.03)', overflow: 'hidden', minWidth: 120 },
  replyContainerMe: { backgroundColor: 'rgba(255,255,255,0.1)' },
  replyContainerThem: { backgroundColor: 'rgba(0,0,0,0.03)' },
  replyBorder: { width: 3, backgroundColor: theme.teal, borderRadius: 2, marginRight: 8 },
  replyBorderMe: { backgroundColor: theme.textWhite },
  replyContent: { flex: 1, paddingHorizontal: 4 },
  replySender: { fontWeight: '700', fontSize: 12, color: theme.teal },
  replySenderMe: { color: 'rgba(255,255,255,0.9)' },
  replySenderThem: { color: theme.teal },
  replyText: { fontSize: 12, color: theme.textSecondary, flexShrink: 1, flexWrap: 'wrap' },
  replyTextMe: { color: 'rgba(255,255,255,0.7)' },
  replyTextThem: { color: theme.textSecondary },
  attachBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: Platform.OS === 'ios' ? 25 : 16, backgroundColor: theme.white, borderTopWidth: 1, borderTopColor: theme.border, gap: 10 },
  inputMainContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#F1F5F9', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: theme.text, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.teal, alignItems: 'center', justifyContent: 'center' },
  voiceBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  voiceBtnActive: { backgroundColor: theme.error },
  voiceBtnCancelled: { backgroundColor: theme.textSecondary },
  recordingArea: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.mode === 'dark' ? '#442222' : '#FFF1F2', borderRadius: 24, paddingHorizontal: 16, height: 44, gap: 10 },
  recordingAreaCancelled: { backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#F1F5F9' },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.error },
  recordingDotCancelled: { backgroundColor: theme.textSecondary },
  recordingText: { color: theme.error, fontWeight: '700' },
  recordingHint: { fontSize: 12, color: theme.textSecondary, marginLeft: 'auto' },
  editBar: { backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#F0F9FF', paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border },
  editText: { color: theme.teal, fontWeight: '600' },
  editCancel: { color: theme.error, fontWeight: '600' },
  replyPreviewWrapper: { padding: 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', alignItems: 'center' },
  replyPreviewContent: { flex: 1 },
  replyPreviewSender: { fontWeight: '700', color: theme.teal, fontSize: 12 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyChatEmoji: { fontSize: 48, marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  previewControls: { 
    position: 'absolute', 
    right: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  previewIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalContent: { width: '80%', backgroundColor: theme.card, borderRadius: 20, padding: 20, ...SHADOW.lg },
  reactionPicker: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
  pickerEmoji: { fontSize: 32 },
  actionList: { marginTop: 10 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  actionText: { fontSize: 16, color: theme.text, fontWeight: '500' },
  
  // Options Modal (Bottom Sheet Style)
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsModalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...SHADOW.lg,
  },
  optionsModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  optionsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 15,
  },
  optionsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  optionsTextDestructive: {
    color: theme.error,
  },
  safetyTipCard: {
    backgroundColor: theme.tealLight,
    padding: 16,
    borderRadius: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.teal,
    gap: 8,
  },
  safetyTipTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.teal,
  },
  safetyTipText: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },
});
