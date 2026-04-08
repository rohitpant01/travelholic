import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, TouchableWithoutFeedback, Dimensions, Modal, FlatList, Image, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../utils/theme';
import { storyAPI } from '../api/services';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  storyId: string;
}

export default function StoryViewerListMenu({ visible, onClose, storyId }: Props) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [viewers, setViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchViewers();
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        // Clear viewers out after closing
        setViewers([]);
      });
    }
  }, [visible]);

  const fetchViewers = async () => {
    setLoading(true);
    try {
      const res = await storyAPI.getViewers(storyId);
      setViewers(res.data.views.reverse()); // latest first
    } catch (e) {
      console.error('Failed to fetch story viewers', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePressProfile = (userId: string) => {
    console.log(`[STORY VIEWER LIST] Navigating to profile, UserId: ${userId}`);
    onClose();
    setTimeout(() => {
      const targetId = String(userId);
      if (targetId === currentUser?._id) {
        navigation.navigate('Profile');
      } else {
        navigation.navigate('UserDetail', { userId: targetId });
      }
    }, 200);
  };

  if (!visible && viewers.length === 0) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.sheet, 
                { 
                  backgroundColor: theme.card,
                  transform: [{ translateY: slideAnim }] 
                }
              ]}
            >
              <View style={styles.handle} />
              
              <View style={styles.header}>
                <Ionicons name="eye-outline" size={24} color={theme.text} />
                <Text style={[styles.headerTitle, { color: theme.text }]}>Story Viewers</Text>
              </View>

              {loading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="small" color={theme.teal} />
                </View>
              ) : viewers.length === 0 ? (
                <View style={styles.centerContainer}>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No views yet.</Text>
                </View>
              ) : (
                <FlatList
                  data={viewers}
                  keyExtractor={(item, index) => item.userId?._id || index.toString()}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => {
                    const usr = item.userId;
                    if (!usr) return null; // Safe guard
                    
                    return (
                      <TouchableOpacity 
                        style={styles.viewerRow} 
                        onPress={() => handlePressProfile(usr._id)}
                        activeOpacity={0.7}
                      >
                        <Image 
                          source={{ uri: usr.photos?.[0]?.url || 'https://via.placeholder.com/150' }}
                          style={styles.avatar}
                        />
                        <View style={styles.viewerInfo}>
                          <Text style={[styles.name, { color: theme.text }]}>
                            {usr.firstName} {usr.lastName}
                          </Text>
                          <Text style={[styles.username, { color: theme.textSecondary }]}>
                            @{usr.username}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    height: SCREEN_HEIGHT * 0.6, // covers 60% of screen
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
    gap: 10,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
  },
  viewerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  username: {
    fontSize: 13,
    marginTop: 2,
  },
});
