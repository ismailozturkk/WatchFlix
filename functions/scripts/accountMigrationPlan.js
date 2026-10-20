// functions/scripts/accountMigrationPlan.js
//
// Saf (firebase-admin'siz) göç planlayıcı: BİR kullanıcının kök Users/{uid}
// belgesindeki özel alanlar için ne yazılacağını ve kökten neyin silineceğini
// söyler. Çalıştırıcı: migrateAccountPrivate.js. Ayrı dosya çünkü jest'te
// (Admin SDK kurmadan) test ediliyor — __tests__/accountMigrationPlan.test.js.
//
// Neden bu alanlar: Users/{uid} TÜM oturumlulara okunur
// (docs/mimari/KULLANICI_OZEL_ALAN_GOCU.md).
//   • email, birthDate  → Users/{uid}/private/account
//   • expoPushToken, expoPushTokens, pushTokenUpdatedAt → Users/{uid}/private/push
//     (B3'te taşındı; kökte yalnız hiç güncellenmemiş hesapların kalıntısı var)

const ACCOUNT_FIELDS = ["email", "birthDate"];
const PUSH_FIELDS = ["expoPushToken", "expoPushTokens", "pushTokenUpdatedAt"];
const ALL_ROOT_FIELDS = [...ACCOUNT_FIELDS, ...PUSH_FIELDS];

const has = (obj, key) =>
  !!obj && Object.prototype.hasOwnProperty.call(obj, key);
const text = (value) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/**
 * @param {{root?: object, account?: object|null, push?: object|null}} input
 *   root: kök belgenin verisi; account/push: gizli belgelerin verisi (yoksa null)
 * @returns {{
 *   accountPatch: object|null,   // private/account'a merge edilecek
 *   pushPatch: {tokens: string[], token: string|null}|null,
 *   rootDelete: string[],        // kökten silinecek alan adları
 *   conflicts: string[],         // elle bakılacak durumlar (silinmez)
 * }}
 */
function planUserMigration({ root, account, push } = {}) {
  const accountPatch = {};
  const rootDelete = [];
  const conflicts = [];

  for (const key of ACCOUNT_FIELDS) {
    if (!has(root, key)) continue;
    const value = text(root[key]);
    const existing = text(account?.[key]);
    // Gizli belge KAZANIR: e-posta sonradan değişmiş olabilir. Tarih için
    // çelişki kural gereği olmamalı; olursa körlemesine birini seçme, bırak.
    if (key === "birthDate" && value && existing && value !== existing) {
      conflicts.push("birthDate: kök ile private/account farklı");
      continue;
    }
    if (value && !existing) accountPatch[key] = value;
    rootDelete.push(key);
  }

  const rootTokens = [];
  if (text(root?.expoPushToken)) rootTokens.push(text(root.expoPushToken));
  if (Array.isArray(root?.expoPushTokens)) {
    for (const t of root.expoPushTokens) if (text(t)) rootTokens.push(text(t));
  }
  const known = new Set(
    [
      text(push?.expoPushToken),
      ...(Array.isArray(push?.expoPushTokens) ? push.expoPushTokens : []),
    ].filter(Boolean),
  );
  // UNION, kopyalama değil: aynı hesapta iki cihaz olabilir (biri B3 öncesi
  // sürümde, kök jetonu hâlâ o yazıyor). Birleştirmek bildirim kaybını önler;
  // ölü jetonları sunucu (clearDeadPushTokens) zaten ayıklıyor.
  const newTokens = [...new Set(rootTokens)].filter((t) => !known.has(t));
  const latest = text(root?.expoPushToken);
  const pushPatch =
    newTokens.length > 0 || (latest && !text(push?.expoPushToken))
      ? { tokens: newTokens, token: latest && !text(push?.expoPushToken) ? latest : null }
      : null;
  for (const key of PUSH_FIELDS) if (has(root, key)) rootDelete.push(key);

  return {
    accountPatch: Object.keys(accountPatch).length > 0 ? accountPatch : null,
    pushPatch,
    rootDelete,
    conflicts,
  };
}

module.exports = { ACCOUNT_FIELDS, PUSH_FIELDS, ALL_ROOT_FIELDS, planUserMigration };
