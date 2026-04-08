import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchSinglePost, Post } from '../store/slices/feedSlice';
import TravelPostCard from '../components/TravelPostCard';
import PostCommentsModal from '../components/PostCommentsModal';
import PostLikesModal from '../components/PostLikesModal';
import EditPostModal from '../components/EditPostModal';
import WebDownloadBanner from '../components/WebDownloadBanner';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAppTheme, SHADOW } from '../utils/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Platform } from 'react-native';


type PostDetailRouteProp = RouteProp<RootStackParamList, 'PostDetail'>;

const PostDetailScreen = () => {
  const route = useRoute<PostDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useDispatch<AppDispatch>();
  const theme = useAppTheme();
  const styles = getStyles(theme);

  const { postId } = route.params;

  // 🛡️ RE-RENDER STABILIZER: Use Redux selector instead of local state
  // This ensures that when a post is edited, the Detail screen updates instantly.
  const post = useSelector((state: RootState) =>
    state.feed.posts.find(p => p._id === postId)
  );

  const [loading, setLoading] = useState(!post);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const commentsModalRef = useRef<BottomSheetModal>(null);
  const likesModalRef = useRef<BottomSheetModal>(null);
  const editModalRef = useRef<any>(null);

  const loadPost = async () => {
    try {
      setError(null);
      const resultAction = await dispatch(fetchSinglePost(postId));
      if (!fetchSinglePost.fulfilled.match(resultAction) && !post) {
        setError('This post might have been deleted or is unavailable.');
      }
    } catch (err) {
      setError('Failed to load post.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!postId) {
      console.log('[PostDetail] Missing postId, redirecting...');
      if (isAuthenticated) {
        navigation.navigate('MainTabs', { screen: 'Travelers' });
      } else {
        navigation.navigate('Auth');
      }
      return;
    }
    loadPost();
  }, [postId, isAuthenticated]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPost();
  };

  if (loading && !post) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.teal} />
      </View>
    );
  }

  if (error && !post) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.textLight} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadPost}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentPost = post!;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.teal} />
        }
      >
        {Platform.OS === 'web' && <WebDownloadBanner id={postId} type="post" />}
        {post ? (
          <TravelPostCard
            post={post}
            onPressProfile={(userId) => navigation.navigate('UserDetail', { userId })}
            onPressComment={() => commentsModalRef.current?.present()}
            onPressLikes={() => likesModalRef.current?.present()}
            onPressEdit={() => editModalRef.current?.present()}
          />
        ) : (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={theme.teal} />
          </View>
        )}
        {!isAuthenticated && (
          <View style={styles.guestCta}>
            <LinearGradient colors={[theme.teal + '20', 'transparent']} style={styles.guestGradient} />
            <Ionicons name="lock-closed" size={32} color={theme.teal} style={{ marginBottom: 12 }} />
            <Text style={styles.guestTitle}>Join the Conversation</Text>
            <Text style={styles.guestSubtitle}>Sign in to like, comment, and connect with travelers worldwide.</Text>
            <TouchableOpacity 
              style={styles.guestBtn}
              onPress={() => navigation.navigate('Auth')}
            >
              <Text style={styles.guestBtnText}>Login / Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <PostCommentsModal ref={commentsModalRef} postId={postId} />
      <PostLikesModal ref={likesModalRef} postId={postId} />
      <EditPostModal
        ref={editModalRef}
        postId={postId}
        initialContent={post?.content || ''}
      />
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
    backgroundColor: theme.background,
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
  scrollContent: {
    paddingVertical: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  errorText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.teal,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 100,
  },
  guestCta: {
    margin: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: theme.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.teal + '30',
    overflow: 'hidden',
    ...SHADOW.md,
  },
  guestGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  guestBtn: {
    backgroundColor: theme.teal,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    ...SHADOW.md,
  },
  guestBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  }
});

export default PostDetailScreen;
