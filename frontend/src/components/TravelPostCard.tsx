import React from 'react';
import { 
  View, Text, StyleSheet, Image, 
  TouchableOpacity, Share, ActivityIndicator, Alert,
  ScrollView, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Post, toggleLikeAction, deletePostAction, editPostAction } from '../store/slices/feedSlice';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import OptionsMenu, { MenuOption } from './OptionsMenu';
import { SHADOW, useAppTheme } from '../utils/theme';
import { feedAPI } from '../api/services';

interface Props {
  post: Post;
  onPressProfile?: (userId: string) => void;
  onPressComment?: (postId: string) => void;
  onPressLikes?: (postId: string) => void;
  onPressEdit?: (post: Post) => void;
}
const TravelPostCard = ({ post, onPressProfile, onPressComment, onPressLikes, onPressEdit }: Props) => {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const styles = getStyles(theme);

  const [menuVisible, setMenuVisible] = React.useState(false);
  const [reportingMenuVisible, setReportingMenuVisible] = React.useState(false);

  const user = post.userId; 
  const isTemp = (post as any).isTemporary;
  const status = (post as any).status;
  const isOwner = currentUser?._id === (typeof user === 'string' ? user : user?._id);

  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const cardWidth = Dimensions.get('window').width - 32; // Assuming margingHorizontal is 16

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / cardWidth);
    if (index !== activeImageIndex) setActiveImageIndex(index);
  };

  const likeDebounceRef = React.useRef(false);

  const handleLike = () => {
    if (isTemp || likeDebounceRef.current) return;
    likeDebounceRef.current = true;
    dispatch(toggleLikeAction(post._id));
    // Block re-taps for 800ms to let the server respond
    setTimeout(() => { likeDebounceRef.current = false; }, 800);
  };

  const handleShare = async () => {
    const shareUrl = `https://ekalgo.com/post/${post._id}`;
    const safeContent = (post.content || '').trim();
    try {
      await Share.share({
        title: `EkalGo: Travel moment by ${user?.firstName || 'Traveler'}`,
        message: `Check out this travel moment shared by ${user?.firstName || 'a traveler'} on EkalGo! 🌍✨\n\n"${safeContent}"\n\nView Full Journey: ${shareUrl}`,
        url: shareUrl, // iOS only
      });
    } catch (e) {}
  };

  const handleSendReport = async (reason: string) => {
    try {
      await feedAPI.reportPost(post._id, { reason });
      Alert.alert('Success', 'Thank you for your report. Our team will review this content shortly to keep the community safe.');
    } catch (error) {
      Alert.alert('Error', 'Failed to send report. Please try again later.');
    }
  };

  const getMenuOptions = (): MenuOption[] => {
    const opts: MenuOption[] = [];
    
    if (isOwner) {
      opts.push({
        label: 'Edit Post',
        iconName: 'pencil-outline',
        onPress: () => onPressEdit?.(post)
      });
      opts.push({
        label: 'Delete Post',
        iconName: 'trash-outline',
        color: theme.error,
        onPress: () => {
          Alert.alert('Delete Post', 'Are you sure you want to delete this moment forever?', [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Delete', 
              style: 'destructive',
              onPress: () => dispatch(deletePostAction(post._id))
            }
          ]);
        }
      });
    } else {
      opts.push({
        label: 'Report Post',
        iconName: 'warning-outline',
        color: theme.error,
        onPress: () => {
          setTimeout(() => setReportingMenuVisible(true), 250);
        }
      });
    }

    opts.push({
      label: 'Share',
      iconName: 'share-social-outline',
      onPress: handleShare
    });
    return opts;
  };

  const getReportingOptions = (): MenuOption[] => {
    return [
      { label: 'Spam', iconName: 'information-circle-outline', onPress: () => handleSendReport('spam') },
      { label: 'Inappropriate Content', iconName: 'information-circle-outline', onPress: () => handleSendReport('inappropriate') },
      { label: 'Harassment', iconName: 'information-circle-outline', onPress: () => handleSendReport('harassment') },
      { label: 'Fake Location', iconName: 'information-circle-outline', onPress: () => handleSendReport('fake_location') },
      { label: 'Scam Listing', iconName: 'information-circle-outline', onPress: () => handleSendReport('scam_listing') },
      { label: 'Unsafe Place Info', iconName: 'information-circle-outline', onPress: () => handleSendReport('unsafe_place') },
    ];
  };

  return (
    <View style={[styles.card, (isTemp && status === 'uploading') && { opacity: 0.8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.userInfo} 
          onPress={() => onPressProfile?.(user?._id)}
          activeOpacity={0.7}
        >
          <Image 
            source={{ uri: user?.photos?.[0]?.url || 'https://via.placeholder.com/150' }} 
            style={styles.avatar} 
          />
          <View>
            <Text style={styles.name}>{user?.firstName || 'Traveler'}, {user?.age || ''}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={10} color={theme.teal} />
              <Text style={styles.location}>{post.placeName || 'Exploring'}</Text>
            </View>
          </View>
        </TouchableOpacity>
        {isTemp ? (
          <View style={[styles.postingBadge, status === 'failed' && { backgroundColor: theme.error + '20' }]}>
            {status === 'failed' ? (
              <Ionicons name="alert-circle" size={14} color={theme.error} />
            ) : (
              <ActivityIndicator size="small" color={theme.teal} />
            )}
            <Text style={[styles.postingText, status === 'failed' && { color: theme.error }]}>
              {status === 'failed' ? 'Failed' : 'Posting...'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.5} onPress={() => setMenuVisible(true)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {post.content ? (
        <Text style={styles.content}>{post.content}</Text>
      ) : null}

      {/* Media */}
      {post.images && post.images.length > 0 ? (
        <View style={styles.mediaContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={cardWidth}
            snapToAlignment="start"
          >
            {post.images.map((imgUri, index) => (
              <Image 
                key={index}
                source={{ uri: imgUri }} 
                style={[styles.postImage, { width: cardWidth }]} 
                resizeMode="cover" 
              />
            ))}
          </ScrollView>

          {post.images.length > 1 && (
            <View style={styles.paginationDots}>
              {post.images.map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.dot, 
                    i === activeImageIndex && { backgroundColor: theme.teal }
                  ]} 
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* Interaction Bar */}
      <View style={styles.footer}>
        <View style={styles.actions}>
          <View style={styles.likesContainer}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={handleLike}
              activeOpacity={0.6}
            >
              <Ionicons 
                name={post.isLiked ? "heart" : "heart-outline"} 
                size={26} 
                color={post.isLiked ? theme.error : theme.text} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => post._id && !isTemp && onPressLikes?.(post._id)}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 15 }}
            >
              <Text style={styles.countText}>{post.likesCount || 0}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => onPressComment?.(post._id)}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
            <Text style={styles.countText}>{post.commentsCount || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={handleShare}
            activeOpacity={0.6}
            disabled={isTemp}
          >
            <Ionicons name="paper-plane-outline" size={24} color={isTemp ? theme.textLight : theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 💡 Generate Itinerary CTA */}
      {post.content && !isTemp && post.allowAIItinerary !== false && (
        <TouchableOpacity
          style={styles.lyraBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('LyraItinerary', {
            caption: post.content,
            location: post.placeName || '',
            postId: post._id,
          })}
        >
          <Ionicons name="sparkles" size={16} color={theme.teal} />
          <Text style={styles.lyraBtnText}>Generate Itinerary</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.teal} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      <OptionsMenu 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)} 
        options={getMenuOptions()} 
      />

      <OptionsMenu 
        visible={reportingMenuVisible} 
        onClose={() => setReportingMenuVisible(false)} 
        options={getReportingOptions()} 
      />
    </View>
  );
}

export default React.memo(TravelPostCard);

const getStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 24,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    ...SHADOW.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.border,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  content: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaContainer: {
    width: '100%',
    height: 350,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.border,
    marginBottom: 12,
  },
  postImage: {
    height: '100%',
  },
  paginationDots: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    paddingTop: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  postingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.teal + '10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postingText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.teal,
  },
  lyraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.teal + '08',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.teal + '25',
  },
  lyraBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.teal,
  },
});
