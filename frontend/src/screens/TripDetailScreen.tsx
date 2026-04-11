import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView,
  Alert, TextInput, Modal, Image, ActivityIndicator, RefreshControl, Platform
} from 'react-native';
import KeyboardWrapper from '../components/KeyboardWrapper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { tripAPI } from '../api/services';
import { RootState } from '../store';

const MODE_ICONS: Record<string, string> = {
  flight: '✈️', train: '🚂', car: '🚗', bus: '🚌', bike: '🏍️', other: '🌍',
};

export default function TripDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const { user } = useSelector((s: RootState) => s.auth);
  const { tripId } = route.params;

  const [trip, setTrip] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joining, setJoining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrip = useCallback(async () => {
    try {
      const res = await tripAPI.getTrip(tripId);
      setTrip(res.data.trip);
      setMembers(res.data.members);
      setUserStatus(res.data.userStatus);
      setUserRole(res.data.userRole);

      // Fetch pending requests if admin
      if (res.data.userRole === 'admin') {
        const reqRes = await tripAPI.getPendingRequests(tripId);
        setPendingRequests(reqRes.data.requests);
      }
    } catch (e) {
      console.error('[TripDetail] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { fetchTrip(); }, [fetchTrip]);

  const handleJoin = async () => {
    try {
      setJoining(true);
      await tripAPI.joinTrip(tripId, joinMessage);
      Alert.alert('✅ Request Sent!', 'The trip creator will review your request.');
      setShowJoinModal(false);
      setUserStatus('pending');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const handleMemberAction = async (userId: string, action: string) => {
    try {
      await tripAPI.handleMember(tripId, userId, action);
      Alert.alert('Done', `Request ${action}ed`);
      fetchTrip();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Action failed');
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    Alert.alert('Remove Member', `Remove ${name} from this trip?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await tripAPI.removeMember(tripId, userId);
            fetchTrip();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed to remove');
          }
        },
      },
    ]);
  };

  const handleDeleteTrip = () => {
    Alert.alert('Delete Trip', 'Are you sure? This will remove all members and chat history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await tripAPI.deleteTrip(tripId);
            nav.goBack();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleLeave = () => {
    Alert.alert('Leave Trip', 'Are you sure you want to leave this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          try {
            await tripAPI.removeMember(tripId, user._id);
            nav.goBack();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed to leave');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.teal} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textSecondary }}>Trip not found</Text>
      </View>
    );
  }

  const isAdmin = userRole === 'admin';
  const isMember = userStatus === 'accepted';
  const acceptedMembers = members.filter(m => m.status === 'accepted');

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const getProfilePhoto = (u: any) =>
    u?.photos?.find((p: any) => p.isProfile)?.url || u?.photos?.[0]?.url;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {trip.source?.city} → {trip.destination?.city}
        </Text>
        {isAdmin && (
          <TouchableOpacity onPress={handleDeleteTrip} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTrip(); }} />}
      >
        {/* Trip Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.routeRow}>
            <Text style={styles.modeEmoji}>{MODE_ICONS[trip.mode] || '🌍'}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.routeText}>{trip.source?.city} → {trip.destination?.city}</Text>
              <Text style={styles.dateText}>{MODE_ICONS[trip.mode] || '📅'} {formatDate(trip.date)}</Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Budget</Text>
              <Text style={styles.infoValue}>💸 {trip.budget}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>🧳 {trip.travelType}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Travelers</Text>
              <Text style={styles.infoValue}>👥 {acceptedMembers.length}/{trip.maxTravelers}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue}>👤 {trip.genderPreference}</Text>
            </View>
          </View>

          {trip.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descText}>{trip.description}</Text>
            </View>
          ) : null}

          {trip.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {trip.tags.map((tag: string, i: number) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Members ({acceptedMembers.length})</Text>
          {acceptedMembers.map((m) => (
            <View key={m._id} style={styles.memberRow}>
              <View style={styles.avatar}>
                {getProfilePhoto(m.user) ? (
                  <Image source={{ uri: getProfilePhoto(m.user) }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, { backgroundColor: theme.tealLight, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="person" size={20} color={theme.teal} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.memberName}>
                  {m.user?.firstName} {m.user?.lastName}
                  {m.role === 'admin' ? ' 👑' : ''}
                </Text>
                {m.user?.age && <Text style={styles.memberMeta}>{m.user.gender}, {m.user.age}</Text>}
              </View>
              {isAdmin && m.role !== 'admin' && (
                <TouchableOpacity onPress={() => handleRemoveMember(m.user?._id, m.user?.firstName)}>
                  <Ionicons name="close-circle" size={22} color={theme.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Pending Requests (admin only) */}
        {isAdmin && pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🙋 Join Requests ({pendingRequests.length})</Text>
            {pendingRequests.map((req) => (
              <View key={req._id} style={styles.requestCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.avatar}>
                    {getProfilePhoto(req.user) ? (
                      <Image source={{ uri: getProfilePhoto(req.user) }} style={styles.avatarImg} />
                    ) : (
                      <View style={[styles.avatarImg, { backgroundColor: theme.tealLight, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="person" size={20} color={theme.teal} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.memberName}>{req.user?.firstName} {req.user?.lastName}</Text>
                    {req.message ? (
                      <Text style={styles.requestMsg}>"{req.message}"</Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.success }]}
                    onPress={() => handleMemberAction(req.user?._id, 'accept')}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.error }]}
                    onPress={() => handleMemberAction(req.user?._id, 'reject')}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ padding: SPACING.md, gap: 12 }}>
          {/* Join button */}
          {!userStatus && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowJoinModal(true)}>
              <LinearGradient colors={[theme.teal, theme.tealDark]} style={styles.primaryBtnGrad}>
                <Ionicons name="hand-right" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Join This Trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {userStatus === 'pending' && (
            <View style={[styles.statusBanner, { backgroundColor: '#FFF8E1' }]}>
              <Text style={{ fontSize: FONTS.md, fontWeight: '600', color: '#F0A500' }}>
                ⏳ Your join request is pending...
              </Text>
            </View>
          )}

          {/* Magic Itinerary button */}
          {(isMember || isAdmin) && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => nav.navigate('AIItinerary', { trip })}
            >
              <LinearGradient colors={['#FF6B35', '#FF8A5C']} style={styles.primaryBtnGrad}>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Magic AI Itinerary ✨</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Group Chat button */}
          {isMember && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => nav.navigate('Chat', { 
                type: 'group', 
                chatId: tripId, 
                userName: trip.groupName || `${trip.source?.city} → ${trip.destination?.city}`, 
                userPhoto: trip.groupIcon,
                membersCount: members.length 
              })}
            >
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.primaryBtnGrad}>
                <Ionicons name="chatbubbles" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Open Group Chat 💬</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Leave button */}
          {isMember && !isAdmin && (
            <TouchableOpacity style={styles.dangerBtn} onPress={handleLeave}>
              <Text style={styles.dangerBtnText}>Leave Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal visible={showJoinModal} animationType="slide" transparent onRequestClose={() => setShowJoinModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable 
            style={{ flex: 1 }} 
            onPress={() => setShowJoinModal(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🙋 Join Trip</Text>
            <Text style={{ color: theme.textSecondary, marginBottom: 12 }}>
              Send a message to the trip creator (optional)
            </Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Hey, I'm Rohit, I love exploring cafes…"
              value={joinMessage}
              onChangeText={setJoinMessage}
              multiline
              maxLength={300}
              placeholderTextColor={theme.textSecondary}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.border, flex: 1 }]}
                onPress={() => setShowJoinModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.teal, flex: 1 }]}
                onPress={handleJoin}
                disabled={joining}
              >
                <Text style={styles.modalBtnText}>{joining ? 'Sending...' : 'Send Request'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { fontSize: FONTS.lg, fontWeight: '800', color: '#fff', flex: 1, marginHorizontal: 12 },

  infoCard: {
    margin: SPACING.md, backgroundColor: theme.card,
    borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.md,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  modeEmoji: { fontSize: 40 },
  routeText: { fontSize: FONTS.xl, fontWeight: '800', color: theme.text },
  dateText: { fontSize: FONTS.md, color: theme.textSecondary, marginTop: 2 },

  infoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 8,
  },
  infoItem: {
    width: '47%', backgroundColor: theme.background, borderRadius: RADIUS.md,
    padding: 10,
  },
  infoLabel: { fontSize: FONTS.xs, color: theme.textSecondary, fontWeight: '600' },
  infoValue: { fontSize: FONTS.md, fontWeight: '700', color: theme.text, marginTop: 2 },

  descBox: {
    backgroundColor: theme.background, borderRadius: RADIUS.md,
    padding: 12, marginTop: 12,
  },
  descText: { fontSize: FONTS.md, color: theme.textSecondary, lineHeight: 20 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tagChip: {
    backgroundColor: theme.tealLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  tagText: { fontSize: FONTS.xs, color: theme.tealDark, fontWeight: '600' },

  section: { marginHorizontal: SPACING.md, marginTop: 8 },
  sectionTitle: { fontSize: FONTS.lg, fontWeight: '700', color: theme.text, marginBottom: 12 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card,
    borderRadius: RADIUS.md, padding: 12, marginBottom: 8, ...SHADOW.sm,
  },
  avatar: {},
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  memberName: { fontSize: FONTS.md, fontWeight: '600', color: theme.text },
  memberMeta: { fontSize: FONTS.sm, color: theme.textSecondary },

  requestCard: {
    backgroundColor: theme.card, borderRadius: RADIUS.md,
    padding: 12, marginBottom: 8, ...SHADOW.sm,
  },
  requestMsg: { fontSize: FONTS.sm, color: theme.textSecondary, fontStyle: 'italic', marginTop: 2 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    flex: 1, justifyContent: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.sm },

  primaryBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.md },
  primaryBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: FONTS.lg, fontWeight: '800' },

  statusBanner: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: RADIUS.lg,
    alignItems: 'center',
  },

  dangerBtn: {
    paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: theme.error,
  },
  dangerBtnText: { color: theme.error, fontWeight: '700', fontSize: FONTS.md },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContentContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
  },
  modalTitle: { fontSize: FONTS.xl, fontWeight: '800', color: theme.text, marginBottom: 4 },
  modalInput: {
    backgroundColor: theme.background, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: theme.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: FONTS.md, color: theme.text,
  },
  modalBtn: {
    paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.md },
});
