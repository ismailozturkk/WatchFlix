import {
  BUBBLE_JOIN_RADIUS,
  BUBBLE_RADIUS,
  bubbleRadii,
  outgoingGradient,
  shouldInlineMeta,
} from "../utils/chatBubbleStyle";

describe("bubbleRadii", () => {
  test("a lone outgoing bubble is fully rounded", () => {
    const r = bubbleRadii({ isMe: true });
    expect(Object.values(r).every((v) => v === BUBBLE_RADIUS)).toBe(true);
  });

  test("outgoing blocks join on the right edge only", () => {
    const first = bubbleRadii({ isMe: true, groupBottom: true });
    expect(first.borderBottomRightRadius).toBe(BUBBLE_JOIN_RADIUS);
    expect(first.borderTopRightRadius).toBe(BUBBLE_RADIUS);
    expect(first.borderTopLeftRadius).toBe(BUBBLE_RADIUS);
    expect(first.borderBottomLeftRadius).toBe(BUBBLE_RADIUS);

    const middle = bubbleRadii({ isMe: true, groupTop: true, groupBottom: true });
    expect(middle.borderTopRightRadius).toBe(BUBBLE_JOIN_RADIUS);
    expect(middle.borderBottomRightRadius).toBe(BUBBLE_JOIN_RADIUS);

    const last = bubbleRadii({ isMe: true, groupTop: true });
    expect(last.borderTopRightRadius).toBe(BUBBLE_JOIN_RADIUS);
    expect(last.borderBottomRightRadius).toBe(BUBBLE_RADIUS);
  });

  test("incoming blocks join on the left edge only", () => {
    const middle = bubbleRadii({ isMe: false, groupTop: true, groupBottom: true });
    expect(middle.borderTopLeftRadius).toBe(BUBBLE_JOIN_RADIUS);
    expect(middle.borderBottomLeftRadius).toBe(BUBBLE_JOIN_RADIUS);
    expect(middle.borderTopRightRadius).toBe(BUBBLE_RADIUS);
    expect(middle.borderBottomRightRadius).toBe(BUBBLE_RADIUS);
  });
});

describe("outgoingGradient", () => {
  test("derives a darker end from a hex accent", () => {
    const g = outgoingGradient("#3B82F6");
    expect(g).toHaveLength(2);
    expect(g[0]).toBe("#3B82F6");
    expect(g[1]).not.toBe(g[0]);
  });

  test("falls back to a flat colour for non-hex accents", () => {
    expect(outgoingGradient("rgba(10, 20, 30, 1)")).toBeNull();
    expect(outgoingGradient(undefined)).toBeNull();
  });
});

describe("shouldInlineMeta", () => {
  test("short single-line text keeps the time beside it", () => {
    expect(shouldInlineMeta("Selam")).toBe(true);
  });

  test("long or multi-line text puts the time underneath", () => {
    expect(shouldInlineMeta("Bu mesaj saatin yanına sığmayacak kadar uzun yazıldı")).toBe(false);
    expect(shouldInlineMeta("a\nb")).toBe(false);
    expect(shouldInlineMeta("")).toBe(false);
    expect(shouldInlineMeta(undefined)).toBe(false);
  });
});
