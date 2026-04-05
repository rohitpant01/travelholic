import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, Modal, Image, ActivityIndicator, Platform
} from 'react-native';
import KeyboardWrapper from '../components/KeyboardWrapper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { tripAPI } from '../api/services';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import * as ImagePicker from 'expo-image-picker';

export default function GroupDetailsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((s: RootState) => s.auth);
  const { tripId, groupName: initialName, groupIcon: initialIcon } = route.params;

  const [trip, setTrip] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Group Info state
  const [groupName, setGroupName] = useState(initialName || 'Group Chat');
  const [groupIcon, setGroupIcon] = useState(initialIcon || null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchTripDetails = useCallback(async () => {
    if (!tripId || String(tripId) === 'undefined' || String(tripId) === 'null') {
      console.log('[GroupDetails] No tripId provided. Skipping fetchTripDetails.');
      setLoading(false);
      return;
    }

    try {
      const res = await tripAPI.getTrip(tripId);
      setTrip(res.data.trip);
      setMembers(res.data.acceptedMembers || []); // Ensure this maps to accepted members
      setUserRole(res.data.userRole);

      const name = res.data.trip.groupName || `${res.data.trip.source?.city} → ${res.data.trip.destination?.city}`;
      setGroupName(name);
      if (res.data.trip.groupIcon) {
        setGroupIcon(res.data.trip.groupIcon);
      }
    } catch (e) {
      console.error('[GroupDetails] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      fetchTripDetails();
    }, [fetchTripDetails])
  );

  const isAdmin = userRole === 'admin';

  const handleUpdateName = async () => {
    if (!tempName.trim()) return;
    try {
      setUpdating(true);
      const fd = new FormData();
      fd.append('groupName', tempName);
      await tripAPI.updateGroupInfo(tripId, fd);
      setGroupName(tempName);
      setIsEditingName(false);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update name');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateIcon = async () => {
    if (!isAdmin) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission Denied', 'Needs photos permission');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const fd = new FormData();
        fd.append('icon', { uri, name: 'icon.jpg', type: 'image/jpeg' } as any);

        setUpdating(true);
        const res = await tripAPI.updateGroupInfo(tripId, fd);
        setGroupIcon(res.data.trip.groupIcon);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update icon');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveMember = async (targetUser: any) => {
    if (!isAdmin) return;
    if (targetUser._id === trip?.creator?._id) {
      return Alert.alert('Error', 'Cannot remove the creator of the trip.');
    }
    
    Alert.alert(
      'Remove Member',
      `Remove ${targetUser.firstName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await tripAPI.removeMember(tripId, targetUser._id);
              fetchTripDetails();
            } catch (ignored) {}
          }
        }
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
            try {
              await tripAPI.removeMember(tripId, user._id);
              // Pop all the way to Home/Matches or back
              nav.navigate('Matches'); 
            } catch (ignored) {}
          }
        }
      ]
    );
  };

  const handleMemberPress = (mUser: any) => {
    if (mUser._id === user?._id) {
      nav.navigate('Profile');
    } else {
      nav.navigate('UserDetail', { userId: mUser._id });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handleUpdateIcon} disabled={!isAdmin || updating}>
            {groupIcon ? (
              <Image source={{ uri: groupIcon }} style={styles.groupIcon} />
            ) : (
              <View style={[styles.groupIcon, styles.groupIconPlaceholder]}>
                <Ionicons name="people" size={50} color={COLORS.white} />
              </View>
            )}
            {isAdmin && (
              <View style={styles.editIconBadge}>
                <Ionicons name="camera" size={16} color={COLORS.white} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.nameContainer}>
            <Text style={styles.groupName}>{groupName}</Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => { setTempName(groupName); setIsEditingName(true); }}>
                <Ionicons name="pencil" size={20} color={COLORS.teal} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.membersCount}>Group • {members.length} members</Text>
          {trip && (
            <Text style={styles.routeText}>{trip.source?.city} → {trip.destination?.city}</Text>
          )}
        </View>

        {/* Members List */}
        <View style={styles.card}>
           <Text style={styles.cardTitle}>{members.length} Participants</Text>
           {members.map((m, i) => {
             const mUser = m.user;
             if (!mUser) return null;
             const isMe = mUser._id === user._id;
             const profilePic = mUser.photos?.find((p: any) => p.isProfile)?.url || mUser.photos?.[0]?.url;

             return (
               <TouchableOpacity 
                  key={i} 
                  style={styles.memberRow} 
                  onPress={() => handleMemberPress(mUser)}
                  onLongPress={() => handleRemoveMember(mUser)}
               >
                 <Image 
                   source={profilePic ? { uri: profilePic } : require('../../assets/placeholder.png')} 
                   style={styles.memberAvatar} 
                 />
                 <View style={styles.memberNameContainer}>
                   <Text style={[styles.memberName, isMe && { color: COLORS.teal, fontWeight: '700' }]}>
                     {isMe ? 'You' : `${mUser.firstName} ${mUser.lastName || ''}`}
                   </Text>
                 </View>
                 {m.role === 'admin' && (
                   <View style={styles.adminBadge}>
                     <Text style={styles.adminText}>Admin</Text>
                   </View>
                 )}
                  {isAdmin && !isMe && mUser._id !== trip?.creator?._id && (
                    <TouchableOpacity onPress={() => handleRemoveMember(mUser)} style={{ padding: 8 }}>
                      <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
               </TouchableOpacity>
             );
           })}
        </View>

        {/* Actions */}
        <View style={[styles.card, { marginTop: SPACING.md, marginBottom: SPACING.xl }]}>
          <TouchableOpacity style={styles.actionRow} onPress={handleLeaveGroup}>
            <Ionicons name="exit-outline" size={24} color={COLORS.error} />
            <Text style={styles.actionTextAlert}>Exit Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={isEditingName} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsEditingName(false)}
        >
          <KeyboardWrapper 
            backgroundColor="transparent"
            contentContainerStyle={styles.modalContentContainer}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter new group name</Text>
              <TextInput
                style={styles.input}
                value={tempName}
                onChangeText={setTempName}
                placeholder="Group name"
                autoFocus
                maxLength={50}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setIsEditingName(false)}>
                  <Text style={styles.modalBtnTextAlt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleUpdateName} disabled={updating}>
                   {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardWrapper>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: '#fff', ...SHADOW.sm },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scroll: { paddingBottom: 40 },
  profileSection: { backgroundColor: '#fff', alignItems: 'center', paddingVertical: SPACING.xl, marginBottom: SPACING.md, ...SHADOW.sm },
  groupIcon: { width: 120, height: 120, borderRadius: 60, marginBottom: SPACING.md },
  groupIconPlaceholder: { backgroundColor: COLORS.tealLight, justifyContent: 'center', alignItems: 'center' },
  editIconBadge: { position: 'absolute', bottom: 16, right: 0, backgroundColor: COLORS.teal, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  nameContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  groupName: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  membersCount: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 },
  routeText: { fontSize: 13, color: COLORS.tealDark, fontWeight: '600', backgroundColor: COLORS.tealLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  card: { backgroundColor: '#fff', ...SHADOW.sm },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.teal, marginHorizontal: SPACING.lg, marginTop: SPACING.md, marginBottom: SPACING.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: SPACING.md },
  memberNameContainer: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  adminBadge: { backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  adminText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 16 },
  actionTextAlert: { fontSize: 16, color: COLORS.error, fontWeight: '600', marginLeft: SPACING.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContentContainer: { flexGrow: 1, justifyContent: 'center', padding: SPACING.xl },
  modalContent: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: SPACING.lg, ...SHADOW.lg },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: SPACING.md, color: COLORS.text },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, fontSize: 16, marginBottom: SPACING.lg },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: RADIUS.sm },
  modalBtnPrimary: { backgroundColor: COLORS.teal },
  modalBtnText: { color: '#fff', fontWeight: '600' },
  modalBtnTextAlt: { color: COLORS.teal, fontWeight: '600' },
});
