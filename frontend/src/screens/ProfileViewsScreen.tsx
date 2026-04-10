import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, SHADOW, RADIUS, FONTS, SPACING } from '../utils/theme';
import ScreenWrapper from '../components/ScreenWrapper';
import { userAPI } from '../api/services';
import { formatDistanceToNow } from 'date-fns';

const { width } = Dimensions.get('window');

const ProfileViewsScreen = () => {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<any>();

  const [views, setViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchViews = async () => {
    try {
      const res = await (userAPI as any).getProfileViews();
      setViews(res.data.views || []);
    } catch (e) {
      console.error('[FETCH VIEWS ERROR]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchViews();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchViews();
  };

  const formatTime = (dateStr: string) => {
    try {
      if (!dateStr) return 'some time ago';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'some time ago';
      return formatDistanceToNow(d) + ' ago';
    } catch (e) {
      return 'some time ago';
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('UserDetail', { userId: item._id })}
    >
      <View style={styles.avatarContainer}>
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color={theme.textSecondary} />
          </View>
        )}
        {item.isOnline && <View style={styles.onlineStatus} />}
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>
          {item.firstName} {item.lastName}, {item.age}
        </Text>
        <Text style={styles.location}>
          <Ionicons name="location-outline" size={12} /> {item.city}, {item.country}
        </Text>
        <Text style={styles.time}>{formatTime(item.viewedAt)}</Text>
      </View>

      <TouchableOpacity 
        style={styles.visitBtn}
        onPress={() => navigation.navigate('UserDetail', { userId: item._id })}
      >
        <Text style={styles.visitBtnText}>View</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Profile Visitors</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.teal} />
        </View>
      ) : (
        <FlatList
          data={views}
          keyExtractor={(item, index) => `${item._id}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.teal} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="eye-off" size={60} color={theme.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No Visitors Yet</Text>
              <Text style={styles.emptySubtitle}>
                Your profile is getting ready to be discovered! Try being more active in the community.
              </Text>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    list: {
      padding: 16,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: RADIUS.lg,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...SHADOW.sm,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    avatarPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onlineStatus: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#10b981',
      borderWidth: 2,
      borderColor: theme.card,
    },
    info: {
      flex: 1,
      marginLeft: 14,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 2,
    },
    location: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    time: {
      fontSize: 11,
      color: theme.teal,
      fontWeight: '600',
    },
    visitBtn: {
      backgroundColor: theme.teal + '15',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: RADIUS.full,
    },
    visitBtnText: {
      color: theme.teal,
      fontSize: 13,
      fontWeight: '800',
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
    },
    emptyIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
    },
  });

export default ProfileViewsScreen;
