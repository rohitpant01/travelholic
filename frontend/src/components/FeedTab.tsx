import React, { useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, 
  TouchableOpacity, RefreshControl, Dimensions,
  Image, Platform
} from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import StoryViewer from './StoryViewer';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchFeed, setMode as setFeedMode } from '../store/slices/feedSlice';
import { fetchStories } from '../store/slices/storySlice';
import TravelPostCard from './TravelPostCard';
import CreatePostModal from './CreatePostModal';
import AddStoryModal from './AddStoryModal';
import UploadProgressBar from './UploadProgressBar';
import PostCommentsModal from './PostCommentsModal';
import PostLikesModal from './PostLikesModal';
import EditPostModal from './EditPostModal';
import { COLORS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';
import { useCallback } from 'react';

const { width: W } = Dimensions.get('window');

const FEED_TABS = [
  { id: 'nearby', label: 'Nearby', emoji: '📍' },
  { id: 'friends', label: 'Friends', emoji: '👥' },
  { id: 'global', label: 'Global', emoji: '🌎' },
];

export default function FeedTab() {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const styles = getStyles(theme);
  
  const { posts, loading, mode, page, hasMore } = useSelector((state: RootState) => state.feed);
  const { groupedStories, loading: storiesLoading } = useSelector((state: RootState) => state.stories);
  const { user } = useSelector((state: RootState) => state.auth);

  React.useEffect(() => {
    dispatch(fetchFeed({ mode, page: 1 }));
    dispatch(fetchStories());
  }, [mode]);

  const onRefresh = () => {
    dispatch(fetchFeed({ mode, page: 1 }));
  };

  const onLoadMore = () => {
    if (!loading && hasMore) {
      dispatch(fetchFeed({ mode, page: page + 1 }));
    }
  };

  const handleSubTabChange = (newMode: any) => {
    dispatch(setFeedMode(newMode));
  };

  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isAddStoryVisible, setIsAddStoryVisible] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [isStoryViewerVisible, setIsStoryViewerVisible] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [activeLikesPostId, setActiveLikesPostId] = useState<string | null>(null);
  const [activeEditPost, setActiveEditPost] = useState<any>(null);

  const renderStoryItem = ({ item, index }: any) => {
    if (item._id === 'add') {
      return (
        <TouchableOpacity 
          style={styles.storyCircle} 
          onPress={() => setIsAddStoryVisible(true)}
          activeOpacity={0.8}
        >
          <Image 
            source={{ uri: user?.photos?.[0]?.url || 'https://via.placeholder.com/150' }} 
            style={styles.storyAvatar} 
          />
          <View style={styles.addStoryBadge}>
            <Ionicons name="add" size={12} color="white" />
          </View>
        </TouchableOpacity>
      );
    }

    // item is a StoryGroup
    const isMe = item.userId === user?._id;
    const isAllViewed = item.isAllViewed;

    return (
      <View style={styles.storyItemContainer}>
        <TouchableOpacity 
          style={[
            styles.storyCircle, 
            { borderColor: isAllViewed ? '#8B4513' : theme.teal }
          ]} 
          activeOpacity={0.8}
          onPress={() => {
            console.log(`[STORY CLICK] User bubble: ${item.username}, UserId: ${item.userId}`);
            setSelectedGroup(item);
            setIsStoryViewerVisible(true);
          }}
        >
          <Image 
            source={{ uri: item.profilePic || 'https://via.placeholder.com/150' }} 
            style={styles.storyAvatar} 
          />
          <View style={styles.storyStatus} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => {
            console.log(`[PROFILE CLICK] Story name: ${item.username}, UserId: ${item.userId}`);
            navigation.navigate('UserDetail', { userId: item.userId });
          }}
        >
          <Text style={styles.storyName} numberOfLines={1}>
            {isMe ? 'My Story' : item.username}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = useCallback(() => (
    <View style={styles.feedHeader}>
      {/* Sub-Tabs Switcher */}
      <View style={styles.subTabContainer}>
        {FEED_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => handleSubTabChange(tab.id)}
            style={[
              styles.subTab,
              mode === tab.id && styles.activeSubTab
            ]}
          >
            <Text style={[
              styles.subTabText,
              mode === tab.id && styles.activeSubTabText
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stories Placeholder */}
      <View style={styles.storiesContainer}>
        <Text style={styles.sectionTitle}>Travel Stories</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ _id: 'add' }, ...groupedStories]}
          keyExtractor={(item: any) => item._id || item.userId}
          renderItem={renderStoryItem}
          contentContainerStyle={{ gap: 12 }}
          maxToRenderPerBatch={5}
          initialNumToRender={5}
          removeClippedSubviews={true}
        />
      </View>

      {/* Create Post Bar Placeholder */}
      <TouchableOpacity 
        style={styles.createPostBar}
        onPress={() => {
          console.log('[FEED] Opening CreatePostModal');
          setIsPickerVisible(true);
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.createPostIcon}>
          <Ionicons name="add" size={24} color={theme.textWhite} />
        </View>
        <Text style={styles.createPostText}>Share your travel moments...</Text>
        <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
      </TouchableOpacity>
      
      <View style={styles.divider} />
    </View>
  ), [mode, groupedStories, theme, user]);

  const renderPostItem = useCallback(({ item }: { item: any }) => (
    <TravelPostCard 
      post={item} 
      onPressComment={(id) => {
        setActiveCommentPostId(id);
        commentsSheetRef.current?.present();
      }}
      onPressLikes={(id) => {
        setActiveLikesPostId(id);
        likesSheetRef.current?.present();
      }}
      onPressEdit={(post) => {
        setActiveEditPost(post);
        editSheetRef.current?.present();
      }}
      onPressProfile={(userId) => {
        if (userId === user?._id) {
          navigation.navigate('Profile');
        } else {
          navigation.navigate('UserDetail', { userId });
        }
      }}
    />
  ), [user, navigation]);

  const keyExtractor = useCallback((item: any) => item._id, []);

  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const likesSheetRef = useRef<BottomSheetModal>(null);
  const editSheetRef = useRef<any>(null);

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="images-outline" size={64} color={theme.border} />
              <Text style={styles.emptyText}>Be the first to share a moment!</Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={loading && page === 1} onRefresh={onRefresh} tintColor={theme.teal} />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      <CreatePostModal 
        visible={isPickerVisible} 
        onClose={() => setIsPickerVisible(false)} 
      />

      <AddStoryModal 
        visible={isAddStoryVisible} 
        onClose={() => setIsAddStoryVisible(false)} 
      />

      {isStoryViewerVisible && selectedGroup && (
        <StoryViewer 
          stories={selectedGroup.stories} 
          initialIndex={0} 
          onClose={() => {
            setIsStoryViewerVisible(false);
            setSelectedGroup(null);
          }} 
        />
      )}
      
      <UploadProgressBar />

      <PostCommentsModal 
        ref={commentsSheetRef}
        postId={activeCommentPostId || ''} 
      />

      <PostLikesModal
        ref={likesSheetRef}
        postId={activeLikesPostId || ''}
      />

      <EditPostModal
        ref={editSheetRef}
        postId={activeEditPost?._id || ''}
        initialContent={activeEditPost?.content || ''}
      />
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  listContent: { paddingBottom: 40 },
  feedHeader: { padding: 20 },
  
  // Sub-Tabs
  subTabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderRadius: 15,
    padding: 4,
    marginBottom: 24,
  },
  subTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeSubTab: {
    backgroundColor: theme.background,
    ...SHADOW.sm,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activeSubTabText: {
    color: theme.teal,
    fontWeight: '800',
  },

  // Stories
  storiesContainer: { marginBottom: 24 },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: theme.text, 
    marginBottom: 12 
  },
  storyCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: theme.teal,
    padding: 2,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: theme.mode === 'dark' ? '#1a1a1a' : '#f0f0f0',
  },
  addStoryBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.teal,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyStatus: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: 'transparent', // Default, we set teal for others
  },
  storyItemContainer: {
    alignItems: 'center',
    width: 70,
  },
  storyName: {
    fontSize: 10,
    color: theme.textSecondary,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },

  // Create Post Bar
  createPostBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    padding: 12,
    borderRadius: 20,
    marginBottom: 20,
  },
  createPostIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createPostText: {
    flex: 1,
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginHorizontal: -20,
  },

  emptyFeed: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textLight,
    fontWeight: '600',
    textAlign: 'center',
  },
});
