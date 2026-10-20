// Sikayet kaydinin saf dogrulamasi.
//
// Bu testlerin isi, firestore.rules -> ContentReports kuralinin bekledigi
// SEKLI sabitlemek. Kural alan listesini ve tipleri siki dogruluyor; istemci
// bozuk kayit uretirse yazma permission-denied ile duser ve kullanici
// sebebini anlamadigi bir hata gorur.

const {
  buildReport,
  REPORT_REASONS,
  REPORT_TYPES,
  PREVIEW_MAX,
} = require("../utils/reportValidation");

const gecerli = {
  type: "comment",
  targetPath: "MovieComment/550/comments/abc",
  targetUserId: "bob",
  reporterId: "alice",
  targetPreview: "kotu bir yorum",
  reason: "harassment",
};

describe("buildReport", () => {
  test("gecerli girdi normalize edilmis veri dondurur", () => {
    const r = buildReport(gecerli);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({
      type: "comment",
      targetPath: "MovieComment/550/comments/abc",
      targetUserId: "bob",
      reporterId: "alice",
      targetPreview: "kotu bir yorum",
      reason: "harassment",
    });
    // createdAt SERVISTE ekleniyor (serverTimestamp) - saf fonksiyon zaman
    // uretmemeli, yoksa test edilemez ve istemci saati kayitlara sizar.
    expect(r.data.createdAt).toBeUndefined();
  });

  test("bilinmeyen tip reddedilir", () => {
    expect(buildReport({ ...gecerli, type: "post" })).toEqual({
      ok: false,
      error: "type",
    });
    expect(buildReport({ ...gecerli, type: undefined }).ok).toBe(false);
  });

  test("her tur kabul edilir", () => {
    for (const type of REPORT_TYPES) {
      expect(buildReport({ ...gecerli, type }).ok).toBe(true);
    }
  });

  test("zorunlu alanlar eksikse hangi alan oldugunu soyler", () => {
    expect(buildReport({ ...gecerli, reporterId: "" }).error).toBe("reporterId");
    expect(buildReport({ ...gecerli, reporterId: "   " }).error).toBe("reporterId");
    expect(buildReport({ ...gecerli, targetUserId: null }).error).toBe("targetUserId");
    expect(buildReport({ ...gecerli, targetPath: "" }).error).toBe("targetPath");
  });

  test("kendini sikayet etmek reddedilir", () => {
    expect(buildReport({ ...gecerli, targetUserId: "alice" }).error).toBe("self");
    // Bosluklar kirpilarak karsilastirilir.
    expect(buildReport({ ...gecerli, targetUserId: " alice " }).error).toBe("self");
  });

  test("bilinmeyen sebep reddedilmez, other'a duser", () => {
    expect(buildReport({ ...gecerli, reason: "uydurma" }).data.reason).toBe("other");
    expect(buildReport({ ...gecerli, reason: undefined }).data.reason).toBe("other");
  });

  test("tum tanimli sebepler korunur", () => {
    for (const reason of REPORT_REASONS) {
      expect(buildReport({ ...gecerli, reason }).data.reason).toBe(reason);
    }
  });

  test("onizleme kirpilir ve string olmayan deger bos stringe duser", () => {
    const uzun = "a".repeat(PREVIEW_MAX + 50);
    expect(buildReport({ ...gecerli, targetPreview: uzun }).data.targetPreview).toHaveLength(
      PREVIEW_MAX,
    );
    // Kural her alanin string olmasini istiyor: null/undefined yazilamaz.
    expect(buildReport({ ...gecerli, targetPreview: null }).data.targetPreview).toBe("");
    expect(buildReport({ ...gecerli, targetPreview: 42 }).data.targetPreview).toBe("");
    expect(buildReport({ ...gecerli, targetPreview: "  bosluklu  " }).data.targetPreview).toBe(
      "bosluklu",
    );
  });

  test("girdi hic verilmezse patlamaz", () => {
    expect(buildReport().ok).toBe(false);
    expect(buildReport(undefined).error).toBe("type");
  });
});
