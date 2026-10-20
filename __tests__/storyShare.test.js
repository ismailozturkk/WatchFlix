// __tests__/storyShare.test.js
// Estetik sinema kartı şablonları ve dışa aktarma servis testleri

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(async () => "file:///tmp/story_card.png"),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
}));

// SDK 57: kayit islemi legacy girisinden yapilir (bkz. storyShareService).
jest.mock("expo-media-library/legacy", () => ({
  saveToLibraryAsync: jest.fn(async () => {}),
}));

const {
  captureStoryCard,
  shareStoryImage,
  saveStoryToGallery,
} = require("../services/storyShare/storyShareService");

describe("Story Share Service", () => {
  test("captureStoryCard görünüm referansından resim URI'si üretir", async () => {
    const mockRef = { current: {} };
    const uri = await captureStoryCard(mockRef);
    expect(uri).toBe("file:///tmp/story_card.png");
  });

  test("viewRef yoksa hata fırlatır", async () => {
    await expect(captureStoryCard(null)).rejects.toThrow("Görünüm referansı bulunamadı.");
  });

  test("shareStoryImage paylaşım diyaloğunu çağırır", async () => {
    const Sharing = require("expo-sharing");
    await shareStoryImage("file:///tmp/story_card.png");
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///tmp/story_card.png",
      expect.objectContaining({ mimeType: "image/png" }),
    );
  });

  test("saveStoryToGallery galeri izni alır ve kaydeder", async () => {
    const Legacy = require("expo-media-library/legacy");
    await saveStoryToGallery("file:///tmp/story_card.png");
    expect(Legacy.saveToLibraryAsync).toHaveBeenCalledWith("file:///tmp/story_card.png");
  });

  test("captureStoryCard boyut verilirse çıktıyı o piksele ölçekletir", async () => {
    const { captureRef } = require("react-native-view-shot");
    captureRef.mockClear();
    await captureStoryCard({ current: {} }, { width: 1080, height: 1920 });
    expect(captureRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1920, format: "png" }),
    );
    captureRef.mockClear();
    await captureStoryCard({ current: {} });
    expect(captureRef.mock.calls[0][1]).not.toHaveProperty("width");
  });

  test("captureStoryCard ilk yakalama düşerse bir kez yeniden dener", async () => {
    const { captureRef } = require("react-native-view-shot");
    captureRef.mockClear();
    captureRef.mockRejectedValueOnce(new Error("boş kare"));
    const uri = await captureStoryCard({ current: {} });
    expect(uri).toBe("file:///tmp/story_card.png");
    expect(captureRef).toHaveBeenCalledTimes(2);
  });

  test("şemasız yol file:// ile paylaşılır", async () => {
    const Sharing = require("expo-sharing");
    Sharing.shareAsync.mockClear();
    await shareStoryImage("/data/cache/card.png");
    expect(Sharing.shareAsync.mock.calls[0][0]).toBe("file:///data/cache/card.png");
  });
});
