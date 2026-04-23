import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchNotifications, markNotificationsRead, markAllRead, markSingleRead } from '../store/slices/notificationSlice';
import { useSocket } from '../context/SocketContext';
import { useAppTheme } from '../utils/theme';
import { formatDistanceToNow } from 'date-fns';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import ScreenWrapper from '../components/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NotificationsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useDispatch<AppDispatch>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);
  const { notifications, loading, unreadCount } = useSelector((state: RootState) => state.notification);
  const [refreshing, setRefreshing] = useState(false);
  const { socket } = useSocket();

  // 🛡️ RE-RENDER STABILIZER: Move navigation params logic here
  const handleNotificationPress = (item: any) => {
    console.log('[DEBUG] NOTIFICATION CLICKED:', { id: item._id, type: item.type, data: item.data });
    
    // Optimistically mark this one as read
    dispatch(markSingleRead(item._id));
    
    const type = item.type;
    const data = item.data || {};
    const senderId = item.sender?._id || item.sender;

    // 🎯 PRIORITY 1: Match/Connection (Highest Priority as per User Request)
    if (type === 'match') {
      if (senderId) {
        navigation.navigate('UserDetail', { userId: String(senderId) });
        return;
      }
      navigation.navigate('MainTabs', { screen: 'Matches' } as any);
      return;
    }

    // 🎯 PRIORITY 2: Super Likes
    if (type === 'superlike' && senderId) {
      navigation.navigate('UserDetail', { userId: String(senderId) });
      return;
    }

    // 🎯 PRIORITY 2.1: Likes (Distinguish between Post and Profile)
    if (type === 'like') {
      const postId = data.postId || data.id; 
      if (postId) {
        // Keep existing post like behavior
        navigation.navigate('PostDetail', { postId: String(postId) });
      } else if (senderId) {
        // This is a Profile Like
        navigation.navigate('UserDetail', { userId: String(senderId) });
      }
      return;
    }

    // 🎯 PRIORITY 3: Comments
    if (type === 'comment') {
      const postId = data.postId || data.id;
      if (postId) {
        navigation.navigate('PostDetail', { postId: String(postId) });
        return;
      }
    } 
    
    // 🎯 PRIORITY 4: Trip-related
    if (type === 'trip_join_request' || type === 'trip_accepted' || type === 'trip_member_joined') {
      if (data.tripId) {
        navigation.navigate('TripDetail', { tripId: data.tripId });
        return;
      }
      if (type === 'trip_member_joined' && senderId) {
        navigation.navigate('UserDetail', { userId: String(senderId) });
        return;
      }
    } 
    
    // 🎯 PRIORITY 5: Discover/Feed fallbacks
    if (type === 'nearby_travelers' || type === 'trending_trip') {
      navigation.navigate('MainTabs', { screen: 'Travelers' } as any); 
      return;
    } 
    
    // 🎯 PRIORITY 6: Direct Chat/Matches
    if (data.tripId) {
      navigation.navigate('Chat', { 
        type: 'group',
        chatId: data.tripId,
        userName: item.title || 'Trip Chat' 
      });
      return;
    } 
    
    if (data.matchId) {
      if (senderId && type !== 'match') {
         // Generic fallback
      }
      navigation.navigate('MainTabs', { screen: 'Matches' } as any);
      return;
    }

    // 🎯 PRIORITY 7: Moderation & System Notices (Instagram style alert or Navigation)
    const moderationTypes = [
      'warning_received', 'suspension_received', 'ban_received', 
      'content_removed', 'content_hidden', 'content_restored', 'report_resolved', 'content_reported'
    ];

    if (moderationTypes.includes(type)) {
      // If it's a resolved report notification, navigate to details
      if (type === 'report_resolved') {
        if (data.reportId) {
          navigation.navigate('ReportDetail', { reportId: data.reportId });
        } else {
          // Fallback if ID was stripped by old schema: go to list
          navigation.navigate('MyReports');
        }
        return;
      }

      // Default: show alert for other moderation types
      Alert.alert(
        item.title || 'System Notification',
        item.message,
        [
          { text: 'Got it' },
        ]
      );
      return;
    }

    console.warn('[DEBUG] Notification fallthrough or unhandled type! Type:', type, 'Data:', data);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [dispatch, socket])
  );

  const loadNotifications = async () => {
    setRefreshing(true);
    
    // 🔑 KEY FIX: Mark as read in DB FIRST (before fetching)
    dispatch(markAllRead()); // optimistic UI update
    await dispatch(markNotificationsRead()); 
    
    await dispatch(fetchNotifications());
    setRefreshing(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return { name: 'heart', color: '#ef4444' };
      case 'superlike':
        return { name: 'star', color: '#f59e0b' }; // Gold
      case 'comment':
        return { name: 'chatbubble', color: theme.teal };
      case 'match':
        return { name: 'flash', color: '#f59e0b' };
      case 'trip_join_request':
        return { name: 'airplane', color: '#3b82f6' };
      case 'trip_accepted':
        return { name: 'checkmark-circle', color: '#10b981' };
      case 'trip_member_joined':
        return { name: 'people', color: '#8b5cf6' };
      case 'nearby_travelers':
        return { name: 'location', color: '#f59e0b' };
      case 'trending_trip':
        return { name: 'flame', color: '#ef4444' };
      case 'warning_received':
        return { name: 'warning', color: '#f59e0b' };
      case 'suspension_received':
      case 'ban_received':
      case 'content_removed':
        return { name: 'alert-circle', color: '#ef4444' };
      case 'content_hidden':
        return { name: 'eye-off', color: theme.textSecondary };
      case 'content_restored':
      case 'report_resolved':
        return { name: 'checkmark-circle', color: theme.teal };
      default:
        return { name: 'notifications', color: theme.teal };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const icon = getIcon(item.type);
    const profilePhoto = item.sender?.photos?.find((p: any) => p.isProfile)?.url || item.sender?.photos?.[0]?.url;

    return (
      <TouchableOpacity 
        style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconContainer}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: icon.color + '20' }]}>
              <Ionicons name={icon.name as any} size={20} color={icon.color} />
            </View>
          )}
          <View style={[styles.typeBadge, { backgroundColor: icon.color }]}>
             <Ionicons name={icon.name as any} size={10} color="#fff" />
          </View>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </Text>
        </View>

        {!item.isRead && <View style={styles.unreadIndicator} />}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper withTopInset={false} withBottomInset={false}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.teal} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadNotifications} tintColor={theme.teal} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubText}>We'll notify you when someone likes you or joins your trip!</Text>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
};

const getStyles = (theme: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Math.max(insets.top, 16),
    paddingBottom: 15,
    backgroundColor: theme.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  listContent: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  unreadItem: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(0, 180, 255, 0.1)' : 'rgba(0, 180, 212, 0.05)',
  },
  iconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.card,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.teal,
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default NotificationsScreen;
