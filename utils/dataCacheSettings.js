import AsyncStorage from "@react-native-async-storage/async-storage";

export const AUTO_DATA_CACHE_KEY = "autoDownloadData";

let autoDataCacheEnabled = false;

export const getAutoDataCacheEnabled = () => autoDataCacheEnabled;

export const setAutoDataCacheEnabled = (enabled) => {
  autoDataCacheEnabled = !!enabled;
};

export const hydrateAutoDataCacheSetting = async () => {
  try {
    const raw = await AsyncStorage.getItem(AUTO_DATA_CACHE_KEY);
    setAutoDataCacheEnabled(raw === "true");
    return autoDataCacheEnabled;
  } catch {
    setAutoDataCacheEnabled(false);
    return false;
  }
};

export const shouldPersistInternetData = ({ force = false } = {}) =>
  force || autoDataCacheEnabled;
