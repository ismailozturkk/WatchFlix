import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoHaptics from "expo-haptics";

const HAPTICS_STORAGE_KEY = "hapticsEnabled";

// Tercih okunana kadar titreşimi kapalı tutmak, daha önce kapatmış bir
// kullanıcının uygulama açılışında kısa süreli titreşim almasını engeller.
let enabled = false;
let preferenceVersion = 0;

const hydrationPromise = AsyncStorage.getItem(HAPTICS_STORAGE_KEY)
  .then((storedValue) => {
    if (preferenceVersion !== 0) return;
    // Kayıt yoksa varsayılan: kapalı.
    enabled = storedValue === null ? false : JSON.parse(storedValue) !== false;
  })
  .catch(() => {
    if (preferenceVersion === 0) enabled = false;
  });

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;
export const AndroidHaptics = ExpoHaptics.AndroidHaptics;

export function setHapticsEnabled(nextValue) {
  preferenceVersion += 1;
  enabled = !!nextValue;
}

export function isHapticsEnabled() {
  return enabled;
}

async function runIfEnabled(callback) {
  await hydrationPromise;
  if (!enabled) return;
  return callback();
}

export function selectionAsync() {
  return runIfEnabled(() => ExpoHaptics.selectionAsync());
}

export function impactAsync(style = ImpactFeedbackStyle.Medium) {
  return runIfEnabled(() => ExpoHaptics.impactAsync(style));
}

export function notificationAsync(type = NotificationFeedbackType.Success) {
  return runIfEnabled(() => ExpoHaptics.notificationAsync(type));
}

export function performAndroidHapticsAsync(type) {
  return runIfEnabled(() => ExpoHaptics.performAndroidHapticsAsync(type));
}
