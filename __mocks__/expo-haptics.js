// __mocks__/expo-haptics.js
//
// expo-haptics ESM yayımlanıyor ve jest `transformIgnorePatterns` yalnız `expo/`
// paketini dönüştürüyor. Titreşim servisi (services/hapticsService.js) artık
// oyun kancaları, SwitchToggle gibi pek çok modülden dolaylı yükleniyor; bu
// otomatik taklit olmadan o testler "Cannot use import statement" ile düşerdi.
// Servisin kendi testi `jest.doMock("expo-haptics", …)` ile bunu ezer.

const ImpactFeedbackStyle = { Light: "light", Medium: "medium", Heavy: "heavy", Soft: "soft", Rigid: "rigid" };
const NotificationFeedbackType = { Success: "success", Warning: "warning", Error: "error" };
const AndroidHaptics = {
  Confirm: "confirm",
  Reject: "reject",
  Gesture_Start: "gesture-start",
  Gesture_End: "gesture-end",
  Toggle_On: "toggle-on",
  Toggle_Off: "toggle-off",
  Clock_Tick: "clock-tick",
  Context_Click: "context-click",
  Drag_Start: "drag-start",
  Keyboard_Tap: "keyboard-tap",
  Long_Press: "long-press",
  Virtual_Key: "virtual-key",
  Segment_Tick: "segment-tick",
  Segment_Frequent_Tick: "segment-frequent-tick",
};

module.exports = {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  AndroidHaptics,
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
};
