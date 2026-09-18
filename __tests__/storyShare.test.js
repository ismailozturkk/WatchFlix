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
    const MediaLibrary = require("expo-media-library");
    await saveStoryToGallery("file:///tmp/story_card.png");
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith("file:///tmp/story_card.png");
  });
});
