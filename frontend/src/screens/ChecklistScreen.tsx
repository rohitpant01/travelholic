import React, { useState, useEffect, useCallback } from 'react';
import { Pressable, 
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
 } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  FadeInRight, 
  FadeOutLeft, 
  Layout, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { AppDispatch, RootState } from '../store';
import { 
  fetchChecklists, 
  createChecklist, 
  toggleChecklistItem, 
  deleteChecklist,
  duplicateChecklist,
  Checklist,
  ChecklistItem
} from '../store/slices/checklistSlice';
import { useAppTheme } from '../utils/theme';

const { width } = Dimensions.get('window');

const CATEGORIES = ['Essentials', 'Clothing', 'Electronics', 'Documents', 'Toiletries', 'Others'];
const TRIP_TYPES = ['General', 'Beach', 'Trek', 'International', 'Business', 'Solo'];

const ChecklistScreen = () => {
  const theme = useAppTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();

  const { checklists, loading } = useSelector((state: RootState) => state.checklist);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [selectedType, setSelectedType] = useState<any>('General');
  const [useAutoSuggest, setUseAutoSuggest] = useState(true);
  
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    dispatch(fetchChecklists());
  }, [dispatch]);

  const handleCreateList = async () => {
    if (!newListTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your checklist');
      return;
    }

    await dispatch(createChecklist({
      title: newListTitle,
      tripType: selectedType,
      autoSuggest: useAutoSuggest
    }));

    setShowAddModal(false);
    setNewListTitle('');
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Delete Checklist',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteChecklist(id)) }
      ]
    );
  };

  const renderChecklistCard = ({ item }: { item: Checklist }) => (
    <Animated.View 
      entering={FadeInRight} 
      exiting={FadeOutLeft}
      layout={Layout.springify()}
      style={styles.card}
    >
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={() => navigation.navigate('ChecklistDetail', { checklistId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.tripType} • {item.items.length} items</Text>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressText}>{item.progress}%</Text>
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <Animated.View 
            style={[
              styles.progressBarFill, 
              { width: `${item.progress}%` }
            ]} 
          />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.itemCount}>
            {item.items.filter(i => i.isCompleted).length} / {item.items.length} completed
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity 
              onPress={() => dispatch(duplicateChecklist(item._id))}
              style={{ marginRight: 15 }}
            >
              <Ionicons name="copy-outline" size={20} color={theme.teal} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item._id, item.title)}>
              <Ionicons name="trash-outline" size={20} color={theme.error} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Travel Checklists</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && checklists.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.teal} />
        </View>
      ) : (
        <FlatList
          data={checklists}
          renderItem={renderChecklistCard}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={80} color={theme.textLight} />
              <Text style={styles.emptyTitle}>No checklists yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first packing list and be prepared for your adventure!
              </Text>
              <TouchableOpacity 
                style={styles.createBtn}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.createBtnText}>Create New List</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Add Checklist Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Checklist</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Checklist Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. My Summer Trip"
              placeholderTextColor={theme.textSecondary}
              value={newListTitle}
              onChangeText={setNewListTitle}
              autoFocus
            />

            <Text style={styles.label}>Trip Category</Text>
            <View style={styles.typeGrid}>
              {TRIP_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    selectedType === type && styles.typeChipSelected
                  ]}
                  onPress={() => setSelectedType(type)}
                >
                  <Text style={[
                    styles.typeChipText,
                    selectedType === type && styles.typeChipTextSelected
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.suggestToggle}
              onPress={() => setUseAutoSuggest(!useAutoSuggest)}
            >
              <Ionicons 
                name={useAutoSuggest ? "checkbox" : "square-outline"} 
                size={22} 
                color={useAutoSuggest ? theme.teal : theme.textSecondary} 
              />
              <Text style={styles.suggestText}>Auto-suggest essential items</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalCreateBtn}
              onPress={handleCreateList}
            >
              <Text style={styles.modalCreateBtnText}>Create Checklist</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  progressCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.teal + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.teal,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.teal,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    marginBottom: 15,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.teal,
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.teal,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: theme.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  createBtn: {
    marginTop: 30,
    backgroundColor: theme.teal,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 10,
    marginTop: 16,
  },
  input: {
    backgroundColor: theme.background,
    borderRadius: 15,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  typeChipSelected: {
    backgroundColor: theme.teal + '15',
    borderColor: theme.teal,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  typeChipTextSelected: {
    color: theme.teal,
  },
  suggestToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  suggestText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  modalCreateBtn: {
    backgroundColor: theme.teal,
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    marginTop: 30,
  },
  modalCreateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default ChecklistScreen;
