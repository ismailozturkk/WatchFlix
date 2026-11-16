// functions/unverifiedAccounts.js
//
// E-POSTA DOĞRULAMA KAPISININ SUNUCU ARKASI (16 Kas 2026). Doğrulanmamış e-posta+şifre
// hesabı kayıt sırasında profil + kullanıcı adı yazabiliyor (kayıt işlemi bunu ister,
// bkz. firestore.rules isAuthedOwner). Bu modül o hesapların yan etkilerini kapatır:
//   1) (KALDIRILDI 16 Kas) beta Max artık doğrulamayı BEKLEMEZ: kayıt anında verilmeyince yeni
//      testçi abonelik ekranı gördü; Max doğrulanmamış hesaba kurallar yüzünden hiçbir şey açmıyor,
//   2) arkadaş aramasında çıkmaz (searchUsers),
//   3) STALE_UNVERIFIED_DAYS gün doğrulanmazsa silinir → kullanıcı adı ve e-posta serbest
//      kalır (cleanupUnverifiedAccounts),
//   4) aynı adresle Google/Apple girişi gelirse (sağlayıcı adresin sahipliğini kanıtladı)
//      doğrulanmamış hesap silinip girişe izin verilir — başkasının e-postasıyla açılmış
//      "işgal" hesabı gerçek sahibini kilitleyemesin (check*SignInEligibility).
//
// "Doğrulanmış" tanımı firestore.rules emailVerified() ve emailVerifiedGate.js ile AYNI.

const FEDERATED = new Set(["google.com", "apple.com"]);
const STALE_UNVERIFIED_DAYS = 3;
// Yayın tarihi (1 Ocak 2027, UTC). ÖNCESİNDE açılmış doğrulanmamış hesaplar kapısız eski
// sürümlerle uygulamayı serbestçe kullanabiliyordu — listeleri, puanları, sohbetleri olabilir.
// Onlar SİLİNMEZ ve Google/Apple girişiyle DEĞİŞTİRİLMEZ; kapıda e-postalarını doğrulayabilirler.
// Emülatör testleri hesapları "şimdi" açtığından kesimi SEELOGD_TEST_GATE_SINCE_MS ile ezebilir;
// canlı ortamda bu değişken YOKTUR.
const TEST_GATE_SINCE = process.env.SEELOGD_TEST_GATE_SINCE_MS;
const GATE_SINCE_MS =
  TEST_GATE_SINCE && Number.isFinite(Number(TEST_GATE_SINCE))
    ? Number(TEST_GATE_SINCE)
    : Date.UTC(2027, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const providerIds = (record) =>
  (Array.isArray(record?.providerData) ? record.providerData : []).map((p) => p?.providerId);

/** Auth kaydı doğrulanmış mı (e-posta doğrulandı ya da Google/Apple bağlı). */
function isAccountVerified(record) {
  if (!record) return false;
  if (record.emailVerified === true) return true;
  return providerIds(record).some((id) => FEDERATED.has(id));
}

/**
 * Silinebilir doğrulanmamış hesap: YALNIZ şifre sağlayıcısı, e-postası doğrulanmamış,
 * devre dışı bırakılmamış ve kapıdan SONRA (GATE_SINCE_MS) açılmış. (Devre dışı hesaplar bilinçli bir yönetici kararıdır; dokunulmaz.)
 */
function isReplaceableUnverified(record) {
  if (!record || record.disabled) return false;
  if (isAccountVerified(record)) return false;
  const ids = providerIds(record);
  if (!(ids.length > 0 && ids.every((id) => id === "password"))) return false;
  const created = Date.parse(record?.metadata?.creationTime || "");
  // Oluşturma zamanı bilinmiyorsa eski hesap gibi davran: dokunma.
  return Number.isFinite(created) && created >= GATE_SINCE_MS;
}

/** Oluşturulalı `days` günden fazla olmuş silinebilir doğrulanmamış hesap mı. */
function isStaleUnverified(record, nowMs = Date.now(), days = STALE_UNVERIFIED_DAYS) {
  if (!isReplaceableUnverified(record)) return false;
  const created = Date.parse(record?.metadata?.creationTime || "");
  if (!Number.isFinite(created)) return false;
  return nowMs - created > days * DAY_MS;
}

/**
 * uid listesinden Auth'ta doğrulanmış olanların kümesi (getUsers, 100'lük parçalar).
 * Auth kaydı bulunamayan uid doğrulanmamış sayılır.
 */
async function verifiedUidSet(auth, uids) {
  const unique = [...new Set((uids || []).filter((u) => typeof u === "string" && u))];
  const verified = new Set();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { users } = await auth.getUsers(chunk.map((uid) => ({ uid })));
    for (const record of users) if (isAccountVerified(record)) verified.add(record.uid);
  }
  return verified;
}

module.exports = {
  GATE_SINCE_MS,
  STALE_UNVERIFIED_DAYS,
  isAccountVerified,
  isReplaceableUnverified,
  isStaleUnverified,
  verifiedUidSet,
};
