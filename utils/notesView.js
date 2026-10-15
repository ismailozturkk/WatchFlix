// utils/notesView.js
//
// Notlar ekranının SAF mantığı (React/Firebase/i18n importu yok): sıralama,
// arama, todo ilerlemesi, hatırlatıcı tarih durumu, boşluk kontrolü. Ekran bunları
// çağırır; jest ile test edilir (__tests__/notesView.test.js).
//
// Tarihler `scheduledDate` = "YYYY-MM-DD" (yerel gün). Saat dilimi kayması
// olmasın diye hep YEREL gün sınırında hesaplanır.

export const noteCreated = (note) => Number(note?.createdAt || note?.updatedAt || 0);

/**
 * Sabitlenenler önde, her grup kendi içinde en yeni OLUŞTURULAN başta. Son
 * düzenlemeye göre DEĞİL: karttan bir maddeyi tamamlamak updatedAt'i yeniler;
 * o zaman kart parmağın altında listenin başına zıplardı. Eşitlikte girdi
 * sırası korunur (kararlı).
 */
export function sortNotes(notes) {
  const list = Array.isArray(notes) ? notes : [];
  return list
    .map((note, index) => ({ note, index }))
    .sort((a, b) => {
      const pin = Number(!!b.note?.pinned) - Number(!!a.note?.pinned);
      if (pin) return pin;
      const time = noteCreated(b.note) - noteCreated(a.note);
      return time || a.index - b.index;
    })
    .map((item) => item.note);
}

/**
 * Arama için metni sadeleştirir: büyük/küçük harf, Türkçe i/ı/İ/I ayrımı ve
 * aksanlar yok sayılır ("sinema" → "Sinemâ", "ısık" → "ISIK" bulunur).
 */
export function foldText(value) {
  let text = String(value ?? "")
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .toLowerCase();
  if (typeof text.normalize === "function") {
    text = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  return text;
}

/** Notun aranabilir tüm metni: başlık, içerik, film notu metni, todo maddeleri. */
function searchableText(note) {
  return [
    note?.title,
    note?.content,
    note?.text,
    ...(Array.isArray(note?.todos) ? note.todos.map((todo) => todo?.text) : []),
  ]
    .filter(Boolean)
    .map(foldText)
    .join("\n");
}

/** Sorgudaki HER kelime notta geçmeli (sıra önemsiz). Boş sorgu hepsini eşler. */
export function matchesQuery(note, query) {
  const tokens = foldText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = searchableText(note);
  return tokens.every((token) => haystack.includes(token));
}

/** Todo notunun ilerlemesi. `progress` 0..1; maddesiz notta 0 ve `complete` false. */
export function todoStats(note) {
  const todos = Array.isArray(note?.todos) ? note.todos : [];
  const total = todos.length;
  const done = todos.filter((todo) => todo?.done).length;
  return {
    total,
    done,
    pending: total - done,
    progress: total > 0 ? done / total : 0,
    complete: total > 0 && done === total,
  };
}

/** "all" | "active" (bitmemiş) | "done" (tüm maddeleri bitmiş) süzgeci. */
export function filterTodoNotes(notes, filter) {
  const list = Array.isArray(notes) ? notes : [];
  if (filter === "active") return list.filter((note) => !todoStats(note).complete);
  if (filter === "done") return list.filter((note) => todoStats(note).complete);
  return list;
}

export function parseISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Hatırlatıcı gününün bugüne göre durumu.
 * @returns {{ state: "overdue"|"today"|"tomorrow"|"soon"|"later", days: number } | null}
 */
export function dueStatus(iso, now = new Date()) {
  const due = parseISODate(iso);
  if (!due) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  const state =
    days < 0 ? "overdue" : days === 0 ? "today" : days === 1 ? "tomorrow" : days <= 7 ? "soon" : "later";
  return { state, days };
}

/** Bugünden `days` gün sonrasının yerel "YYYY-MM-DD" karşılığı. */
export function dateOffsetISO(days, now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function countWords(text) {
  return (String(text || "").match(/\S+/g) || []).length;
}

/** Kaydedilecek içeriği olmayan not mu? (başlık dahil hiçbir şey yazılmamış) */
export function isNoteEmpty(note) {
  if (!note) return true;
  const hasTitle = String(note.title || "").trim().length > 0;
  if (note.type === "todo") {
    const hasTodo = (note.todos || []).some((todo) => String(todo?.text || "").trim());
    return !hasTitle && !hasTodo;
  }
  return !hasTitle && String(note.content || "").trim().length === 0;
}

/**
 * Tema'nın `notesColor` paletinden editörün renk seçicisi için { color, background }
 * çiftleri üretir. Sıra renk seçicideki sırayı belirler; NotesScreen ve profildeki
 * hızlı ekleme AYNI listeyi kullanır (yeni kayıtta rastgele bir çift seçilir).
 */
export function buildNoteColorPairs(notesColor) {
  return [
    { color: notesColor.blue, background: notesColor.blueBackground },
    { color: notesColor.green, background: notesColor.greenBackground },
    { color: notesColor.red, background: notesColor.redBackground },
    { color: notesColor.orange, background: notesColor.orangeBackground },
    { color: notesColor.yellow, background: notesColor.yellowBackground },
    { color: notesColor.purple, background: notesColor.purpleBackground },
    { color: notesColor.pink, background: notesColor.pinkBackground },
    { color: notesColor.aqua, background: notesColor.aquaBackground },
    { color: notesColor.teal, background: notesColor.tealBackground },
  ];
}

// ─── Sekme çubuğu geometrisi (NotesChrome) ────────────────────────────────────

/** Sekme çubuğunun iç dolgusu (pt). Hap ve sekmeler bu boşluğun içinde durur. */
export const TAB_BAR_PADDING = 4;
/** Rozet bu sayıdan büyükse "99+" yazılır: rozet hiç genişlemesin. */
export const BADGE_MAX = 99;

/**
 * Çubuk içinde tek bir sekmenin genişliği: toplam genişlikten dolgu ve çerçeve
 * düşülür, sekme sayısına bölünür. Seçim hapı bu genişlikte olup `index × genişlik`
 * kadar kayar; ölçülmemiş (0) genişlikte hap çizilmez.
 */
export function segmentWidth(trackWidth, count, border = 0) {
  if (!trackWidth || !count) return 0;
  return Math.max(0, (trackWidth - TAB_BAR_PADDING * 2 - border * 2) / count);
}

/** Rozet metni; 99'dan büyük "99+" olur. */
export function badgeLabel(count) {
  return count > BADGE_MAX ? `${BADGE_MAX}+` : String(count);
}

/**
 * Sekme değişince içeriğin geliş yönü: +1 (sağdan, ilerliyoruz) / -1 (soldan).
 * Bilinmeyen sekme ya da aynı sekme +1 sayılır.
 */
export function tabDirection(order, from, to) {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return 1;
  return b >= a ? 1 : -1;
}
