import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
  StyleSheet, Pressable, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES, CountryData } from '../data/countries';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING, useAppTheme } from '../utils/theme';

interface Props {
  selected: CountryData;
  onSelect: (country: CountryData) => void;
}

export default function CountryCodePicker({ selected, onSelect }: Props) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSelect = (country: CountryData) => {
    onSelect(country);
    setVisible(false);
    setSearch('');
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { borderColor: theme.border, backgroundColor: theme.background }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.flag}>{selected.flag}</Text>
        <Text style={[styles.dialCode, { color: theme.text }]}>{selected.dial}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={[styles.overlay]}>
          <Pressable style={{ flex: 0.15 }} onPress={() => setVisible(false)} />
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Text style={[styles.title, { color: theme.text }]}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchWrap, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="search" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search country or code..."
                placeholderTextColor={theme.textSecondary}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Country List */}
            <FlatList
              data={filtered}
              keyExtractor={item => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.code === selected.code;
                return (
                  <TouchableOpacity
                    style={[styles.row, isSelected && { backgroundColor: theme.teal + '15' }]}
                    onPress={() => handleSelect(item)}
                  >
                    <Text style={styles.rowFlag}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: theme.text }]}>{item.name}</Text>
                    </View>
                    <Text style={[styles.rowDial, { color: theme.teal }]}>{item.dial}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.teal} style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: theme.textSecondary }}>No countries found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    gap: 4,
    minWidth: 95,
  },
  flag: { fontSize: 20 },
  dialCode: { fontSize: 15, fontWeight: '600' },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    flex: 1,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: RADIUS.lg, borderWidth: 1, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20, gap: 12,
  },
  rowFlag: { fontSize: 24 },
  rowName: { fontSize: 15, fontWeight: '500' },
  rowDial: { fontSize: 14, fontWeight: '700' },
});
