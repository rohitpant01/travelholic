import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, FONTS, SPACING } from '../utils/theme';
import userAPI from '../api/services';

interface BlockedUser {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  photo: string | null;
}

export default function BlockedUsersScreen() {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<any>();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      setLoading(true);
      const res = await userAPI.getBlockedUsers();
      setBlockedUsers(res.data.blockedUsers || []);
    } catch (error) {
      console.warn('Failed to fetch blocked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (user: BlockedUser) => {
    Alert.alert(
      `Unblock ${user.firstName}?`,
      `They will be able to see your profile, posts, and send you messages again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unblock', 
          style: 'destructive',
          onPress: async () => {
            try {
              setUnblockingId(user._id);
              await userAPI.unblockUser(user._id);
              // Optimistically update list
              setBlockedUsers(prev => prev.filter(u => u._id !== user._id));
            } catch (error) {
              Alert.alert('Error', 'Failed to unblock user. Please try again.');
            } finally {
              setUnblockingId(null);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        {item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.avatar} />
        ) : (
          <View style={styles.placeholderAvatar}>
            <Ionicons name="person" size={24} color={theme.textWhite} />
          </View>
        )}
        <View style={styles.userNameContainer}>
          <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.usernameText}>@{item.username}</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.unblockBtn}
        onPress={() => handleUnblock(item)}
        disabled={unblockingId === item._id}
      >
        {unblockingId === item._id ? (
          <ActivityIndicator size="small" color={theme.textLight} />
        ) : (
          <Text style={styles.unblockBtnText}>Unblock</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Accounts</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.teal} />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="shield-checkmark-outline" size={64} color={theme.border} />
          <Text style={styles.emptyTitle}>No Blocked Users</Text>
          <Text style={styles.emptySubtitle}>When you block someone, they will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: SPACING.lg,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FONTS.lg,
    fontWeight: '700',
    color: theme.text,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: FONTS.lg,
    fontWeight: 'bold',
    color: theme.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: FONTS.md,
    color: theme.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContainer: {
    paddingVertical: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.background,
  },
  placeholderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userNameContainer: {
    marginLeft: 14,
    flex: 1,
  },
  userName: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  usernameText: {
    fontSize: FONTS.sm,
    color: theme.textLight,
  },
  unblockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  unblockBtnText: {
    fontSize: FONTS.sm,
    fontWeight: '600',
    color: theme.text,
  },
});
