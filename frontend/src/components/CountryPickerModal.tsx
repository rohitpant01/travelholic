import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
  StyleSheet, Pressable, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRY_NAMES } from '../data/countries';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  selected: string[];
  onDone: (countries: string[]) => void;
}

export default function CountryPickerModal({ visible, onClose, selected, onDone }: Props) {
  const theme = useAppTheme();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>(selected);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherValue, setOtherValue] = useState('');

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setPicked(selected);
      setSearch('');
      setShowOtherInput(false);
      setOtherValue('');
    }
  }, [visible, selected]);

  const allItems = useMemo(() => {
    const list = [...COUNTRY_NAMES, 'Other'];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c => c.toLowerCase().includes(q));
  }, [search]);

  const toggleCountry = (name: string) => {
    if (name === 'Other') {
      setShowOtherInput(true);
      return;
    }
    setPicked(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const removeCountry = (name: string) => {
    setPicked(prev => prev.filter(c => c !== name));
  };

  const addOther = () => {
    const val = otherValue.trim();
    if (val && !picked.includes(val)) {
      setPicked(prev => [...prev, val]);
    }
    setOtherValue('');
    setShowOtherInput(false);
  };

  const handleDone = () => {
    onDone(picked);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 0.08 }} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>Countries Visited</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Selected Chips */}
          {picked.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={{ maxHeight: 52, borderBottomWidth: 1, borderBottomColor: theme.border }}
            >
              {picked.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, { backgroundColor: theme.teal + '20', borderColor: theme.teal }]}
                  onPress={() => removeCountry(c)}
                >
                  <Text style={[styles.chipText, { color: theme.teal }]}>{c}</Text>
                  <Ionicons name="close" size={14} color={theme.teal} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Search */}
          <View style={[styles.searchWrap, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search countries..."
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* "Other" text input */}
          {showOtherInput && (
            <View style={[styles.otherWrap, { borderColor: theme.border }]}>
              <TextInput
                style={[styles.otherInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                placeholder="Type country name..."
                placeholderTextColor={theme.textSecondary}
                value={otherValue}
                onChangeText={setOtherValue}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.otherBtn, { backgroundColor: theme.teal }]}
                onPress={addOther}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowOtherInput(false)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Country List */}
          <FlatList
            data={allItems}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isOther = item === 'Other';
              const isSelected = picked.includes(item);
              return (
                <TouchableOpacity
                  style={[styles.row, isSelected && { backgroundColor: theme.teal + '10' }]}
                  onPress={() => toggleCountry(item)}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: isSelected ? theme.teal : theme.border },
                    isSelected && { backgroundColor: theme.teal }
                  ]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  {isOther ? (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="add-circle-outline" size={20} color={theme.teal} />
                      <Text style={[styles.rowName, { color: theme.teal, fontWeight: '700' }]}>Other (Custom)</Text>
                    </View>
                  ) : (
                    <Text style={[styles.rowName, { color: theme.text }]}>{item}</Text>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: theme.textSecondary }}>No countries found</Text>
              </View>
            }
          />

          {/* Done Button */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {picked.length} selected
            </Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: theme.teal }]}
              onPress={handleDone}
            >
              <Text style={styles.doneBtnText}>Done</Text>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: {
    flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '800' },
  chipRow: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: RADIUS.lg, borderWidth: 1, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  otherWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  otherInput: {
    flex: 1, borderWidth: 1, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  otherBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 20, gap: 14,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  rowName: { fontSize: 15, fontWeight: '500', flex: 1 },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderTopWidth: 1,
  },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.full,
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
