// utils/reportValidation.js
//
// Şikâyet kaydının SAF doğrulaması + normalizasyonu. Firestore'a hiç
// dokunmuyor; testi bu yüzden mock istemiyor (__tests__/reportValidation.test.js).
//
// NEDEN AYRI DOSYA: kural tarafı (firestore.rules → ContentReports) alan
// listesini ve tipleri sıkı doğruluyor. İstemci bozuk bir kayıt üretirse
// yazma permission-denied ile düşer ve kullanıcı sebebini anlamadığı bir
// "şikâyet gönderilemedi" görür. Doğrulamayı burada yapıp hatayı ERKEN
// vermek o sessiz reddi engelliyor: kuralın beklediği şekil tek yerde tarif
// ediliyor ve testle sabitleniyor.

/** Şikâyet edilebilen içerik türleri. Kural da bu listeyi doğruluyor. */
export const REPORT_TYPES = Object.freeze(["comment", "message", "user"]);

/**
 * Sebep listesi — UI'daki seçeneklerle birebir aynı sırada.
 * "other" SERBEST METİN ALMAZ: kullanıcının yazdığı metin moderasyon
 * tarafında işlenmediği sürece kişisel veri biriktirmekten başka işe
 * yaramaz (ve o metnin kendisi taciz aracına dönüşebilir).
 */
export const REPORT_REASONS = Object.freeze([
  "spam",
  "harassment",
  "hate_speech",
  "sexual_content",
  "violence",
  "self_harm",
  "misinformation",
  "other",
]);

/**
 * Önizleme: moderatörün şikâyeti bağlamıyla görebilmesi için içeriğin ilk
 * parçası. Uzun tutmanın anlamı yok — kural 300 karakterde reddediyor,
 * biz 200'de kırpıyoruz ki sınıra hiç dayanmayalım.
 */
export const PREVIEW_MAX = 200;

const isNonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

/**
 * Şikâyet dokümanının gövdesini üretir (createdAt HARİÇ — onu servis
 * serverTimestamp ile ekler).
 *
 * @param {object} input
 * @param {"comment"|"message"|"user"} input.type
 * @param {string} input.targetPath      Firestore yolu (ör. "MovieComment/550/comments/abc")
 * @param {string} input.targetUserId    Şikâyet edilen kullanıcının uid'i
 * @param {string} input.reporterId      Şikâyet edenin uid'i
 * @param {string} [input.targetPreview] İçerik metni (kırpılır)
 * @param {string} [input.reason]        Listede yoksa "other"a düşer
 * @returns {{ok: true, data: object} | {ok: false, error: string}}
 */
export function buildReport(input = {}) {
  const { type, targetPath, targetUserId, reporterId, targetPreview, reason } = input;

  if (!REPORT_TYPES.includes(type)) return { ok: false, error: "type" };
  if (!isNonEmpty(reporterId)) return { ok: false, error: "reporterId" };
  if (!isNonEmpty(targetUserId)) return { ok: false, error: "targetUserId" };
  if (!isNonEmpty(targetPath)) return { ok: false, error: "targetPath" };
  // Kendini şikâyet etmek anlamsız; moderasyon kuyruğunu da kirletir.
  if (reporterId.trim() === targetUserId.trim()) return { ok: false, error: "self" };

  // Bilinmeyen sebep reddedilmiyor "other"a düşürülüyor: sebep, şikâyetin
  // kendisinden daha az önemli — sırf etiket yüzünden kayıt kaybetmeyelim.
  const safeReason = REPORT_REASONS.includes(reason) ? reason : "other";

  // Kural her alanın string olmasını istiyor; önizleme yoksa null değil "".
  const preview =
    typeof targetPreview === "string" ? targetPreview.trim().slice(0, PREVIEW_MAX) : "";

  return {
    ok: true,
    data: {
      type,
      targetPath: targetPath.trim(),
      targetUserId: targetUserId.trim(),
      reporterId: reporterId.trim(),
      targetPreview: preview,
      reason: safeReason,
    },
  };
}
