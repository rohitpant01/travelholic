import AsyncStorage from '@react-native-async-storage/async-storage';

const BUCKET_LIST_KEY = '@bucket_list_local';

export interface BucketItem {
  id: string;
  title: string;
  image: string;
  location?: string;
  description?: string;
  rating?: number;
  budget?: string;
  savedAt?: string;
}

export const getLocalBucketList = async (): Promise<BucketItem[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(BUCKET_LIST_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Error reading local bucket list', e);
    return [];
  }
};

export const saveToLocalBucketList = async (item: BucketItem): Promise<boolean> => {
  try {
    const list = await getLocalBucketList();
    const exists = list.some(i => i.id === item.id || i.title === item.title);
    
    if (exists) return false;

    const newList = [{ ...item, savedAt: new Date().toISOString() }, ...list];
    await AsyncStorage.setItem(BUCKET_LIST_KEY, JSON.stringify(newList));
    return true;
  } catch (e) {
    console.error('Error saving to local bucket list', e);
    return false;
  }
};

export const removeFromLocalBucketList = async (id: string): Promise<BucketItem[]> => {
  try {
    const list = await getLocalBucketList();
    const newList = list.filter(i => i.id !== id);
    await AsyncStorage.setItem(BUCKET_LIST_KEY, JSON.stringify(newList));
    return newList;
  } catch (e) {
    console.error('Error removing from local bucket list', e);
    return [];
  }
};

export const clearLocalBucketList = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(BUCKET_LIST_KEY);
  } catch (e) {
    console.error('Error clearing local bucket list', e);
  }
};

// --- EXPLORER CACHE ---
const DISCOVERY_CACHE_KEY = '@discovery_cache';

export const getDiscoveryCache = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(DISCOVERY_CACHE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Error reading discovery cache', e);
    return null;
  }
};

export const saveDiscoveryCache = async (results: any, locationName: string) => {
  try {
    const data = { results, locationName, timestamp: new Date().toISOString() };
    await AsyncStorage.setItem(DISCOVERY_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving discovery cache', e);
  }
};
