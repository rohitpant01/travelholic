import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Image, StyleSheet, TouchableWithoutFeedback, Text, Animated, Alert, Share, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../utils/theme';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { deleteStoryAction, addViewAction } from '../store/slices/storySlice';
import OptionsMenu, { MenuOption } from './OptionsMenu';
import StoryViewerListMenu from './StoryViewerListMenu';

interface StoryItem {
  _id: string;
  mediaUrl: string;
  type: 'image' | 'video';
  user: any;
  userId?: string;
  viewsCount?: number;
}

interface Props {
  stories: StoryItem[];
  initialIndex?: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialIndex = 0, onClose }: Props) {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);

  const [index, setIndex] = useState(initialIndex);
  const [menuVisible, setMenuVisible] = useState(false);
  const [viewerListVisible, setViewerListVisible] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<NodeJS.Timeout | null>(null);
  const isPaused = useRef(false);
  const viewTrackerTimer = useRef<NodeJS.Timeout | null>(null);
  const viewedSessionSet = useRef<Set<string>>(new Set()).current;

  const activeStory = stories[index];
  const isOwner = currentUser?._id === activeStory?.user?._id;

  const startTimer = () => {
    progress.setValue(0);
    const duration = stories[index].type === 'video' ? 8000 : 5000;
    timer.current = setTimeout(() => {
      if (index === stories.length - 1) {
        onClose();
      } else {
        setIndex((i) => i + 1);
      }
    }, duration);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();
  };

  const pauseTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    progress.stopAnimation();
    isPaused.current = true;
  };

  const resumeTimer = () => {
    if (!isPaused.current) return;
    isPaused.current = false;
    const remaining = (1 - (progress as any).__getValue()) * (stories[index].type === 'video' ? 8000 : 5000);
    timer.current = setTimeout(() => {
      if (index === stories.length - 1) {
        onClose();
      } else {
        setIndex((i) => i + 1);
      }
    }, remaining);
    Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    if (!menuVisible && !viewerListVisible) {
      const currentVal = (progress as any).__getValue();
      if (index === initialIndex && currentVal === 0) startTimer();
      else resumeTimer(); // Resume if coming back from menu
    }

    // Story View Tracking Buffer
    if (viewTrackerTimer.current) clearTimeout(viewTrackerTimer.current);
    
    if (activeStory && !isOwner && !viewedSessionSet.has(activeStory._id)) {
      viewTrackerTimer.current = setTimeout(() => {
        dispatch(addViewAction(activeStory._id));
        viewedSessionSet.add(activeStory._id);
      }, 1000); // Only track if they look at it for 1 second
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (viewTrackerTimer.current) clearTimeout(viewTrackerTimer.current);
    };
  }, [index, menuVisible, viewerListVisible]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this travel story by ${activeStory?.user?.firstName} on EkalGo! 🌍`,
        url: activeStory.mediaUrl || 'https://ekalgo.com', 
      });
    } catch (e) {}
  };

  const getMenuOptions = (): MenuOption[] => {
    const opts: MenuOption[] = [];
    
    if (isOwner) {
      opts.push({
        label: 'Delete Story',
        iconName: 'trash-outline',
        color: theme.error,
        onPress: () => {
          Alert.alert('Delete Story', 'Are you sure you want to delete this story?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resumeTimer() },
            { 
              text: 'Delete', 
              style: 'destructive',
              onPress: () => {
                dispatch(deleteStoryAction(activeStory._id));
                if (stories.length === 1) {
                  onClose(); // Last story deleted, close viewer
                } else if (index === stories.length - 1) {
                  setIndex(i => i - 1);
                } else {
                  // Wait for re-render to pick up new story
                  startTimer();
                }
              }
            }
          ]);
        }
      });
    } else {
      opts.push({
        label: 'Report Story',
        iconName: 'warning-outline',
        color: theme.error,
        onPress: () => {
          Alert.alert('Reported', 'Thank you. Our team will review this story shortly.', [{ text: 'OK', onPress: () => resumeTimer() }]);
        }
      });
    }

    opts.push({
      label: 'Share Story',
      iconName: 'share-social-outline',
      onPress: () => {
        resumeTimer();
        handleShare();
      }
    });

    return opts;
  };

  const openMenu = () => {
    pauseTimer();
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuVisible(false);
    resumeTimer();
  };

  const openViewerList = () => {
    pauseTimer();
    setViewerListVisible(true);
  };

  const closeViewerList = () => {
    setViewerListVisible(false);
    resumeTimer();
  };
  const handlePressProfile = () => {
    const rawId = activeStory?.user?._id || activeStory?.user || activeStory?.userId;
    if (!rawId) {
      console.warn('[STORY VIEWER] No userId found for navigation', activeStory);
      return;
    }
    const targetId = typeof rawId === 'object' ? rawId._id : rawId;
    const isMe = String(targetId) === String(currentUser?._id);

    console.log(`[STORY VIEWER] Navigating. Target: ${targetId}, isMe: ${isMe}`);
    onClose();
    
    setTimeout(() => {
      if (isMe) {
        navigation.navigate('Profile');
      } else {
        navigation.navigate('UserDetail', { userId: String(targetId) });
      }
    }, 100);
  };

  return (
    <Modal visible={true} transparent={false} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
        <View style={styles.container}>
          {/* Header Section (Progress + User Info + Close) */}
          <View style={styles.headerContainer}>
            {/* Top progress bar */}
            <View style={styles.progressContainer}>
              {stories.map((_, i) => (
                <View key={i} style={styles.progressBarBackground}>
                  {i === index && (
                    <Animated.View 
                      style={[
                        styles.progressBarFill, 
                        { 
                          width: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%']
                          }) 
                        }
                      ]} 
                    />
                  )}
                </View>
              ))}
            </View>

            {/* User Info Bar */}
            <View style={styles.userInfoBar}>
              <TouchableOpacity 
                style={styles.userLeft} 
                onPress={handlePressProfile}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ uri: stories[index].user?.photos?.[0]?.url || 'https://via.placeholder.com/150' }} 
                  style={styles.avatar} 
                />
                <View>
                  <Text style={styles.username}>
                    {stories[index].user?.firstName} {stories[index].user?.lastName || ''}
                  </Text>
                  <Text style={styles.usernameSub}>@{stories[index].user?.username || 'traveler'}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.headerRight}>
                <TouchableOpacity onPress={openMenu} activeOpacity={0.6} style={styles.iconBtn}>
                  <Ionicons name="ellipsis-horizontal" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={styles.iconBtn}>
                  <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Media Content Section */}
          <View style={styles.mediaContainer}>
            <TouchableWithoutFeedback onPressIn={pauseTimer} onPressOut={resumeTimer}>
              <Image source={{ uri: stories[index].mediaUrl }} style={styles.media} resizeMode="cover" />
            </TouchableWithoutFeedback>

            {/* Tap zones for navigation overlaid on the image */}
            <View style={styles.leftZone} onTouchEnd={() => setIndex((i) => (i > 0 ? i - 1 : i))} />
            <View style={styles.rightZone} onTouchEnd={() => {
              if (index === stories.length - 1) onClose();
              else setIndex((i) => i + 1);
            }} />

            {/* Creator View Dashboard */}
            {isOwner && (
              <View style={styles.viewerBadgeContainer}>
                <TouchableOpacity onPress={openViewerList} style={styles.viewerBadge} activeOpacity={0.8}>
                  <Ionicons name="eye" size={16} color="white" />
                  <Text style={styles.viewerCountText}>{activeStory?.viewsCount || 0} Views</Text>
                  <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <OptionsMenu 
            visible={menuVisible} 
            onClose={closeMenu} 
            options={getMenuOptions()} 
          />

          {isOwner && (
            <StoryViewerListMenu
              visible={viewerListVisible}
              onClose={closeViewerList}
              storyId={activeStory?._id}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  headerContainer: { zIndex: 10, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 15 },
  
  mediaContainer: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 8 },
  media: { width: '100%', height: '100%', backgroundColor: '#111' },
  progressContainer: { flexDirection: 'row', height: 3, width: '100%', marginBottom: 12 },
  progressBarBackground: { flex: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2, borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff' },
  
  userInfoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  userLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  username: { color: 'white', fontSize: 14, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  usernameSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },

  leftZone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '33%', zIndex: 5 },
  rightZone: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '33%', zIndex: 5 },

  viewerBadgeContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  viewerCountText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
