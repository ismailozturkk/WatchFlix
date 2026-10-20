// utils/friendsListModel.js
//
// Arkadaş / mesaj / istek ekranlarının liste mantığı — SAF (React, RN, Firebase
// importu yok), bu yüzden birim test edilebilir. Ekranlar yalnız çizer.
//
//   • Arkadaş listesi A–Z sıralanır ve baş harfe göre bölümlenir.
//   • Süzme alanı yalnız liste uzunsa çıkar (kısa listede yer yiyen bir kutu).
//   • Mesaj sekmesindeki toplam okunmamış sayısı buradan gelir.
//
// Dil: Türkçe'de "i/İ" ve "ı/I" ayrı harflerdir; sıralama ve baş harf
// büyütme `tr-TR` yerel ayarıyla yapılmazsa "İsmail" listenin sonuna düşer.
// ARAMA ise tersine harf biçimine DUYARSIZ olmalı (fold): `tr-TR` küçültmesi
// "ALI"yı "alı" yapar ve "Ali"yi bulamaz; "cagla" yazan da "Çağla"yı bulmalı.

import { intlLocaleOf } from "./appLanguages";

/** Süzme alanının görünmesi için gereken en az öğe sayısı. */
export const FILTER_MIN_ITEMS = 6;

const localeOf = (language) => intlLocaleOf(language);

const text = (value) => (typeof value === "string" ? value : value == null ? "" : String(value));

/**
 * Arama için katlama: İ/I/ı → i, küçük harf, aksanlar atılır (ç→c, ğ→g, ş→s,
 * ö→o, ü→u). Yerel ayardan bağımsız; iki taraf (aranan + aranan metin) aynı
 * işlemden geçtiği için "ALI" ↔ "Ali", "cagla" ↔ "Çağla" eşleşir.
 */
export function foldForSearch(value) {
  const base = text(value).replace(/[İIı]/g, "i").toLowerCase();
  try {
    return base.normalize("NFD").replace(/[̀-ͯ]/g, "");
  } catch {
    return base;
  }
}

const needleOf = (query) => foldForSearch(query).trim();

/** Süzme kutusu bu uzunlukta bir listede gösterilmeli mi? */
export function shouldShowFilter(count) {
  return Number(count) >= FILTER_MIN_ITEMS;
}

/**
 * Kişiyi (ad + kullanıcı adı) aranan metinle eşler. Boş sorgu herkesi geçirir.
 * Baştaki "@" yok sayılır: "@ali" yazan kullanıcı "ali"yi arıyor.
 */
export function personMatchesQuery(person, query) {
  const needle = needleOf(query).replace(/^@/, "");
  if (!needle) return true;
  const haystack = `${foldForSearch(person?.displayName)} ${foldForSearch(person?.username)}`;
  return haystack.includes(needle);
}

/** Ada göre A–Z (Türkçe/İngilizce alfabeye uygun); girdiyi değiştirmez. */
export function sortPeopleByName(people, language) {
  const locale = localeOf(language);
  const key = (p) => text(p?.displayName).trim() || text(p?.username).trim();
  const compare = (a, b) => {
    try {
      return key(a).localeCompare(key(b), locale, { sensitivity: "base" });
    } catch {
      return key(a).localeCompare(key(b));
    }
  };
  return [...(people || [])].sort(compare);
}

/**
 * Harf mi? `\p{L}` unicode özellik kaçışı BİLEREK kullanılmadı: Hermes'te destek
 * sürüme bağlı ve regex hatası uygulamayı açılışta düşürebilir (bkz.
 * utils/typographyRoles.js `harfIceriyor`, utils/emojiText.js). Büyük/küçük hâli
 * farklı olan tek şey harftir — rakam, noktalama ve emoji için ikisi aynıdır.
 * (Büyük/küçük ayrımı olmayan yazılar — Arapça, CJK — "#" bölümüne düşer.)
 */
const isLetter = (ch) => ch.toLowerCase() !== ch.toUpperCase();

/** Bölüm başlığı: adın ilk harfi (büyük); harf değilse "#". */
export function initialOf(person, language) {
  const name = text(person?.displayName).trim() || text(person?.username).trim();
  const first = Array.from(name)[0];
  if (!first || !isLetter(first)) return "#";
  try {
    return first.toLocaleUpperCase(localeOf(language));
  } catch {
    return first.toUpperCase();
  }
}

/**
 * Sıralı kişileri baş harfe göre bölümler: [{ key: "A", data: [...] }, ...].
 * "#" (harf olmayan) her zaman en sonda.
 */
export function groupPeopleByInitial(people, language) {
  const sorted = sortPeopleByName(people, language);
  const sections = [];
  for (const person of sorted) {
    const key = initialOf(person, language);
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.data.push(person);
    else sections.push({ key, data: [person] });
  }
  const hash = sections.findIndex((s) => s.key === "#");
  if (hash >= 0 && hash !== sections.length - 1) sections.push(...sections.splice(hash, 1));
  return sections;
}

/** Toplam okunmamış mesaj sayısı (negatif/bozuk değer 0 sayılır). */
export function totalUnread(conversations) {
  let sum = 0;
  for (const c of conversations || []) {
    const n = Number(c?.unreadCount);
    if (Number.isFinite(n) && n > 0) sum += n;
  }
  return sum;
}

/**
 * Bir grubun BU üye için okunmamış mesaj sayısı. Sayaç grup belgesinde üye
 * başına tutulur (`groups/{id}.unread.{uid}`): gönderen diğer üyeler için
 * artırır, üye sohbeti görünürken kendininkini sıfırlar — 1-1'deki
 * `conversations.unreadCount`'un grup karşılığı. Bozuk/negatif değer 0 sayılır.
 */
export function groupUnreadCount(group, uid) {
  if (!uid) return 0;
  const n = Math.floor(Number(group?.unread?.[uid]));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Tüm grupların bu üye için okunmamış toplamı. */
export function totalGroupUnread(groups, uid) {
  let sum = 0;
  for (const g of groups || []) sum += groupUnreadCount(g, uid);
  return sum;
}

/**
 * Grup mesajı gönderilirken yazılacak `unread` yaması: gönderen DIŞINDAKİ her
 * üye için `bump()` (Firestore `increment(1)`; test edilebilsin diye dışarıdan
 * verilir). Boşsa `null` döner — `set(..., { merge: true })` içinde boş bir
 * `unread: {}` alan maskesine girip mevcut sayaçların hepsini silerdi.
 */
export function groupUnreadIncrements(members, senderUid, bump) {
  const patch = {};
  for (const uid of members || []) {
    if (uid && uid !== senderUid) patch[uid] = bump();
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Sohbet satırlarını kişi adı veya son mesaj metnine göre süzer. */
export function filterConversations(conversations, query) {
  const needle = needleOf(query);
  if (!needle) return conversations || [];
  return (conversations || []).filter((c) =>
    `${foldForSearch(c?.withName)} ${foldForSearch(c?.lastText)}`.includes(needle),
  );
}

/** Grup satırlarını grup adına göre süzer. */
export function filterGroups(groups, query) {
  const needle = needleOf(query);
  if (!needle) return groups || [];
  return (groups || []).filter((g) => foldForSearch(g?.name).includes(needle));
}

/** Firestore Timestamp / Date / epoch ms → epoch ms (yoksa 0). */
export function toEpochMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value.toMillis === "function") return value.toMillis() || 0;
  if (value instanceof Date) return value.getTime() || 0;
  return 0;
}
