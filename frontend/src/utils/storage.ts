import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Unified storage utility for EkalGo.
 * Uses SecureStore for sensitive data (tokens) and AsyncStorage for non-sensitive data.
 */
const storage = {
  /**
   * Save sensitive data securely (Keychain/Keystore)
   */
  async setSecureItem(key: string, value: string) {
    try {
      if (!(await SecureStore.isAvailableAsync())) {
        return await AsyncStorage.setItem(key, value);
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error: any) {
      if (error.message?.includes('native module')) {
        return await AsyncStorage.setItem(key, value);
      }
      console.error(`[Storage] Error setting secure item ${key}:`, error);
    }
  },

  /**
   * Retrieve sensitive data securely
   */
  async getSecureItem(key: string) {
    try {
      if (!(await SecureStore.isAvailableAsync())) {
        return await AsyncStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error: any) {
      if (error.message?.includes('native module')) {
        return await AsyncStorage.getItem(key);
      }
      console.error(`[Storage] Error getting secure item ${key}:`, error);
      return null;
    }
  },

  /**
   * Remove sensitive data
   */
  async removeSecureItem(key: string) {
    try {
      if (!(await SecureStore.isAvailableAsync())) {
        return await AsyncStorage.removeItem(key);
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error: any) {
      if (error.message?.includes('native module')) {
        return await AsyncStorage.removeItem(key);
      }
      console.error(`[Storage] Error deleting secure item ${key}:`, error);
    }
  },

  /**
   * Save non-sensitive data (standard storage)
   */
  async setItem(key: string, value: any) {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
    } catch (error) {
      console.error(`[Storage] Error setting item ${key}:`, error);
    }
  },

  /**
   * Retrieve non-sensitive data
   */
  async getItem(key: string) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error(`[Storage] Error getting item ${key}:`, error);
      return null;
    }
  },

  /**
   * Remove non-sensitive data
   */
  async removeItem(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[Storage] Error removing item ${key}:`, error);
    }
  },

  /**
   * Clear multiple items
   */
  async multiRemove(keys: string[]) {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error(`[Storage] Error multi-removing items:`, error);
    }
  }
};

export default storage;
