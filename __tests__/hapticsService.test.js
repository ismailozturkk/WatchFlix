const loadService = (storedValue = "true") => {
  const nativeHaptics = {
    ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
    NotificationFeedbackType: { Success: "success", Error: "error" },
    AndroidHaptics: {},
    selectionAsync: jest.fn(() => Promise.resolve()),
    impactAsync: jest.fn(() => Promise.resolve()),
    notificationAsync: jest.fn(() => Promise.resolve()),
    performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  };

  jest.doMock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: {
      getItem: jest.fn(() => Promise.resolve(storedValue)),
    },
  }));
  jest.doMock("expo-haptics", () => nativeHaptics);

  return {
    service: require("../services/hapticsService"),
    nativeHaptics,
  };
};

describe("hapticsService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("kayıtlı tercih kapalıyken hiçbir native haptic çağrısı yapmaz", async () => {
    const { service, nativeHaptics } = loadService("false");

    await service.selectionAsync();
    await service.impactAsync(service.ImpactFeedbackStyle.Light);
    await service.notificationAsync(service.NotificationFeedbackType.Error);

    expect(nativeHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.notificationAsync).not.toHaveBeenCalled();
  });

  test("ayar açılınca ortak servis üzerinden titreşime izin verir", async () => {
    const { service, nativeHaptics } = loadService("false");

    service.setHapticsEnabled(true);
    await service.selectionAsync();
    await service.impactAsync(service.ImpactFeedbackStyle.Light);

    expect(nativeHaptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(nativeHaptics.impactAsync).toHaveBeenCalledWith("light");
  });

  test("ayar tekrar kapatılınca sonraki çağrıları anında engeller", async () => {
    const { service, nativeHaptics } = loadService("true");

    await service.selectionAsync();
    service.setHapticsEnabled(false);
    await service.selectionAsync();

    expect(nativeHaptics.selectionAsync).toHaveBeenCalledTimes(1);
  });
});
