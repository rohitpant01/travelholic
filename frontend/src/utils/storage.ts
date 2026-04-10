import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

/**
 * Unified storage utility for EkalGo.
 * Uses SecureStore for sensitive data (tokens) and AsyncStorage for non-sensitive data.
 */
let isSecureStoreAvailableCache: boolean | null = null;
let SecureStoreModule: any = null;

const storage = {
  /**
   * Internal helper to safely check if SecureStore is truly functional
   */
  async isSecureAvailable(): Promise<boolean> {
    if (isSecureStoreAvailableCache !== null) return isSecureStoreAvailableCache;

    try {
      // Platform check: SecureStore is only for Native (iOS/Android)
      if (Platform.OS === 'web') {
        isSecureStoreAvailableCache = false;
        return false;
      }

      // 🛡️ Silent pre-check: Check if the native module is actually linked
      // Accessing NativeModules[name] is silent and returns undefined if missing.
      // Doing require('expo-secure-store') triggers a console error in some Expo versions.
      const isLinked = !!(NativeModules.ExpoSecureStore || NativeModules.SecureStore);
      
      if (!isLinked) {
        isSecureStoreAvailableCache = false;
        return false;
      }

      // Dynamic require now that we know it's linked
      if (!SecureStoreModule) {
        SecureStoreModule = require('expo-secure-store');
      }
      
      if (!SecureStoreModule || typeof SecureStoreModule.isAvailableAsync !== 'function') {
        isSecureStoreAvailableCache = false;
        return false;
      }

      isSecureStoreAvailableCache = await SecureStoreModule.isAvailableAsync();
      return isSecureStoreAvailableCache;
    } catch (e) {
      isSecureStoreAvailableCache = false;
      return false;
    }
  },

  /**
   * Save sensitive data securely (Keychain/Keystore)
   */
  async setSecureItem(key: string, value: string) {
    try {
      const isAvailable = await this.isSecureAvailable();
      if (!isAvailable || !SecureStoreModule) {
        return await AsyncStorage.setItem(key, value);
      }
      await SecureStoreModule.setItemAsync(key, value);
    } catch (error: any) {
      // Secondary fallback if setItemAsync itself crashes
      await AsyncStorage.setItem(key, value);
      console.error(`[Storage] SecureStore.setItemAsync failed for ${key}, fell back to AsyncStorage:`, error.message);
    }
  },

  /**
   * Retrieve sensitive data securely
   */
  async getSecureItem(key: string) {
    try {
      const isAvailable = await this.isSecureAvailable();
      if (!isAvailable || !SecureStoreModule) {
        return await AsyncStorage.getItem(key);
      }
      return await SecureStoreModule.getItemAsync(key);
    } catch (error: any) {
      // Secondary fallback
      const val = await AsyncStorage.getItem(key);
      console.error(`[Storage] SecureStore.getItemAsync failed for ${key}, returning AsyncStorage value:`, error.message);
      return val;
    }
  },

  /**
   * Remove sensitive data
   */
  async removeSecureItem(key: string) {
    try {
      const isAvailable = await this.isSecureAvailable();
      if (!isAvailable || !SecureStoreModule) {
        return await AsyncStorage.removeItem(key);
      }
      await SecureStoreModule.deleteItemAsync(key);
    } catch (error: any) {
      await AsyncStorage.removeItem(key);
      console.error(`[Storage] SecureStore.deleteItemAsync failed for ${key}, cleared AsyncStorage instead:`, error.message);
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
      
      // Handle the common "[object Object]" corruption error
      if (value === '[object Object]') {
        console.warn(`[Storage] Corrupted data found for key: ${key}. Clearing it.`);
        await AsyncStorage.removeItem(key);
        return null;
      }

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
