import { countEmojiClusters, isEmojiOnly } from "../utils/emojiText";

describe("emoji-only detection", () => {
  test("plain emoji", () => {
    expect(isEmojiOnly("😀")).toBe(true);
    expect(isEmojiOnly("🔥🔥🔥")).toBe(true);
    expect(isEmojiOnly("  ❤️  ")).toBe(true);
  });

  test("emoji sequences count as one cluster", () => {
    expect(countEmojiClusters("👍🏽")).toBe(1); // cilt tonu
    expect(countEmojiClusters("👨‍👩‍👧")).toBe(1); // ZWJ aile
    expect(countEmojiClusters("🇹🇷")).toBe(1); // bayrak
    expect(countEmojiClusters("🇹🇷🇺🇸")).toBe(2);
    expect(countEmojiClusters("1️⃣")).toBe(1); // keycap
  });

  test("space between emoji is allowed", () => {
    expect(countEmojiClusters("😀 😀")).toBe(2);
  });

  test("any text disqualifies", () => {
    expect(isEmojiOnly("selam 😀")).toBe(false);
    expect(isEmojiOnly("😀 selam")).toBe(false);
    expect(isEmojiOnly("1")).toBe(false);
    expect(isEmojiOnly("")).toBe(false);
    expect(isEmojiOnly("   ")).toBe(false);
    expect(isEmojiOnly(null)).toBe(false);
  });

  test("more than three clusters is a normal bubble", () => {
    expect(isEmojiOnly("😀😀😀")).toBe(true);
    expect(isEmojiOnly("😀😀😀😀")).toBe(false);
  });

  test("dangling joiners are rejected", () => {
    expect(countEmojiClusters("‍")).toBe(-1);
    expect(countEmojiClusters("😀‍")).toBe(-1);
  });
});
