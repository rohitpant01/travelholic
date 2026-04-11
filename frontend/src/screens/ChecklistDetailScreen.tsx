import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useRoute, useNavigation } from '@react-navigation/native';
import ScreenWrapper from '../components/ScreenWrapper';
import { AppDispatch, RootState } from '../store';
import {
  toggleChecklistItem,
  addItem,
  removeItem,
  ChecklistItem,
} from '../store/slices/checklistSlice';
import { useAppTheme } from '../utils/theme';

const CATEGORIES = ['Essentials', 'Clothing', 'Electronics', 'Documents', 'Toiletries', 'Others'];

const ChecklistDetailScreen = () => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);
  const route = useRoute<any>();
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();

  const { checklistId } = route.params;
  const { checklists } = useSelector((state: RootState) => state.checklist);

  const checklist = useMemo(
    () => checklists.find(c => c._id === checklistId),
    [checklists, checklistId]
  );

  const [newItemTitle, setNewItemTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Others');
  const [activeTab, setActiveTab] = useState('All');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const filteredItems = useMemo(() => {
    if (!checklist) return [];
    if (activeTab === 'All') return checklist.items;
    return checklist.items.filter(item => item.category === activeTab);
  }, [checklist, activeTab]);

  const handleAddItem = async () => {
    if (!newItemTitle.trim() || !checklist) return;
    try {
      setIsAdding(true);
      await dispatch(addItem({ checklistId, title: newItemTitle, category: selectedCategory })).unwrap();
      setNewItemTitle('');
    } catch {
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = (itemId: string) => {
    dispatch(toggleChecklistItem({ checklistId, itemId }));
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await dispatch(removeItem({ checklistId, itemId })).unwrap();
    } catch {
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  if (!checklist) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.teal} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: ChecklistItem }) => (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={Layout.springify()}
      style={styles.itemRow}
    >
      <TouchableOpacity style={styles.checkboxContainer} onPress={() => handleToggle(item._id)}>
        <Ionicons
          name={item.isCompleted ? 'checkbox' : 'square-outline'}
          size={24}
          color={item.isCompleted ? theme.teal : theme.textSecondary}
        />
      </TouchableOpacity>

      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, item.isCompleted && styles.itemTitleCompleted]}>
          {item.title}
        </Text>
        <Text style={styles.itemCategory}>{item.category}</Text>
      </View>

      <TouchableOpacity onPress={() => handleDeleteItem(item._id)}>
        <Ionicons name="close-circle-outline" size={20} color={theme.textLight} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <ScreenWrapper withTopInset={false} withBottomInset={false}>
      {/* ✅ KEY FIX: KeyboardAvoidingView wraps the ENTIRE screen */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{checklist.title}</Text>
            <Text style={styles.headerSubtitle}>{checklist.progress}% Complete</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${checklist.progress}%` }]} />
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScroll}
          >
            <TouchableOpacity
              style={[styles.tab, activeTab === 'All' && styles.activeTab]}
              onPress={() => setActiveTab('All')}
            >
              <Text style={[styles.tabText, activeTab === 'All' && styles.activeTabText]}>All</Text>
            </TouchableOpacity>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.tab, activeTab === cat && styles.activeTab]}
                onPress={() => setActiveTab(cat)}
              >
                <Text style={[styles.tabText, activeTab === cat && styles.activeTabText]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ✅ FlatList is INSIDE KeyboardAvoidingView so it shrinks when keyboard opens */}
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContainer}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No items in this category</Text>
            </View>
          }
        />

        {/* Input Area — always visible above keyboard */}
        <View style={styles.inputArea}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catPicker}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, selectedCategory === cat && styles.catChipSelected]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextSelected]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { maxHeight: 100 }]}
              placeholder="Add new item..."
              placeholderTextColor={theme.textSecondary}
              value={newItemTitle}
              onChangeText={setNewItemTitle}
              onSubmitEditing={handleAddItem}
              returnKeyType="done"
              multiline={true}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.addBtn, !newItemTitle.trim() && { opacity: 0.5 }]}
              onPress={handleAddItem}
              disabled={!newItemTitle.trim() || isAdding}
            >
              {isAdding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="add" size={28} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

const getStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === 'ios' ? 10 : 20),
      paddingBottom: 15,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: {
      padding: 8,
      marginLeft: -8,
    },
    headerInfo: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.teal,
      fontWeight: '700',
      marginTop: 2,
    },
    progressBarBg: {
      height: 4,
      backgroundColor: theme.border,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.teal,
    },
    tabContainer: {
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabScroll: {
      paddingHorizontal: 15,
      paddingVertical: 12,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      marginRight: 8,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activeTab: {
      backgroundColor: theme.teal,
      borderColor: theme.teal,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    activeTabText: {
      color: '#fff',
    },
    listContainer: {
      padding: 20,
      paddingBottom: 20,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      padding: 15,
      borderRadius: 15,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    checkboxContainer: {
      marginRight: 12,
    },
    itemInfo: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    itemTitleCompleted: {
      textDecorationLine: 'line-through',
      color: theme.textSecondary,
      opacity: 0.6,
    },
    itemCategory: {
      fontSize: 11,
      color: theme.textLight,
      marginTop: 2,
    },
    // ✅ paddingBottom uses insets.bottom to clear nav bar
    inputArea: {
      backgroundColor: theme.card,
      paddingTop: 15,
      paddingHorizontal: 15,
      paddingBottom: insets.bottom || 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    catPicker: {
      marginBottom: 12,
    },
    catChip: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      marginRight: 8,
      backgroundColor: theme.background,
    },
    catChipSelected: {
      backgroundColor: theme.teal + '20',
    },
    catChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    catChipTextSelected: {
      color: theme.teal,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    input: {
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 40,
    },
    emptyText: {
      color: theme.textSecondary,
    },
  });

export default ChecklistDetailScreen;