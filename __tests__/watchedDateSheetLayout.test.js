const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "components", "detail", "WatchedDateSheet.js"),
  "utf8",
);

describe("WatchedDateSheet kompakt düzen sözleşmesi", () => {
  test("seçili tarih üstte, üç küçük tarih seçeneği aynı satırda ve takvim ortadadır", () => {
    const summary = source.indexOf("styles.selectionSummary");
    const row = source.indexOf("<View style={styles.quickRow}>", summary);
    const today = source.indexOf('icon="time-outline"', row);
    const calendar = source.indexOf("calendarDate={selectedDate || today}", today);
    const release = source.indexOf('title={i18nText("autoI18n.yayin_tarihi"', calendar);

    expect(summary).toBeGreaterThan(0);
    expect(row).toBeGreaterThan(summary);
    expect(calendar).toBeGreaterThan(today);
    expect(release).toBeGreaterThan(calendar);
    expect(source).toContain("styles.calendarPreview");
  });

  test("puan alanında sıfırlama ve yorum alanında tek satırdan büyüme bulunur", () => {
    expect(source).toContain("onPress={() => setRatingDraft(0)}");
    expect(source).toContain("await removeMyRating({ mediaType, mediaId, uid: user.uid })");
    expect(source).toContain("onContentSizeChange={({ nativeEvent }) =>");
    expect(source).toContain("setCommentInputHeight(Math.max(42, Math.min(104, next)))");
    expect(source).toContain("flexDirection: \"row\"");
  });
});
