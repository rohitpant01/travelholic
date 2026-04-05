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

const NotificationsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useDispatch<AppDispatch>();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const { notifications, loading, unreadCount } = useSelector((state: RootState) => state.notification);
  const [refreshing, setRefreshing] = useState(false);
  const { socket } = useSocket();

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [dispatch, socket])
  );

  const loadNotifications = async () => {
    setRefreshing(true);
    
    // 🔑 KEY FIX: Mark as read in DB FIRST (before fetching)
    // This ensures when we fetch, the backend returns unreadCount: 0
    dispatch(markAllRead()); // optimistic UI update
    await dispatch(markNotificationsRead()); // REST API → persists to DB
    
    // Now fetch — unreadCount returned from server will be 0
    await dispatch(fetchNotifications());
    
    setRefreshing(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return { name: 'heart', color: '#ef4444' };
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
        onPress={() => {
            // Optimistically mark this one as read
            dispatch(markSingleRead(item._id));
            
            // Navigate based on type
            if (item.type === 'trip_join_request' || item.type === 'trip_accepted' || item.type === 'trip_member_joined') {
              navigation.navigate('TripDetail', { tripId: item.data.tripId });
            } else if (item.type === 'nearby_travelers' || item.type === 'trending_trip') {
              navigation.navigate('MainTabs', { screen: 'Discover' } as any);
            } else if (item.data?.tripId) {
              navigation.navigate('Chat', { 
                type: 'group',
                chatId: item.data.tripId,
                userName: item.title || 'Trip Chat' 
              });
            } else if (item.data?.matchId) {
              navigation.navigate('MainTabs', { screen: 'Matches' } as any);
            }
        }}
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
    </View>
  );
};

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
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
