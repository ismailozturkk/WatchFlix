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

// ─── Izgara (masonry) yerleşimi ───────────────────────────────────────────────
//
// İki sütunlu görünümde kartlar satır satır değil SÜTUN SÜTUN dizilir: her kart,
// o ana kadar en kısa kalan sütuna girer. Satır tabanlı ızgarada (FlatList
// numColumns) bir satırın yüksekliğini en uzun kart belirler; kısa kartın altı
// boş kalırdı. Sütun içinde kartlar arka arkaya durduğundan boşluk oluşmaz — kart
// yüksekliği tahmini sapsa bile yalnız iki sütunun toplam boyu biraz farklı çıkar.
//
// Gerçek yükseklik render'dan önce bilinmez; ölçüp yeniden dağıtmak kartları
// sütunlar arasında zıplatırdı. Bu yüzden yükseklik NoteCard'ın düzen sabitlerinden
// ve metin uzunluğundan TAHMİN edilir (kararlı: aynı not + genişlik = aynı sütun).

// NoteCard (grid) düzen sabitleri — screens/tabs/profile/notes/NoteCards.js `st`.
const CARD_CHROME = 2 + 4 + 10 + 10; // kenarlık + üst şerit + üst/alt iç boşluk
const HEAD_ROW = 22 + 8;
const DUE_CHIP_ROW = 22 + 8;
const TITLE_LINE = 21;
const TITLE_GAP = 6;
const CONTENT_LINE = 20;
const CONTENT_GAP = 8;
const CONTENT_MAX_LINES = 7;
const TITLE_MAX_LINES = 2;
const TODO_ROW = 18;
const TODO_GAP = 6;
const TODO_MORE = 14;
const TODO_PROGRESS = 4 + 14;
const TODO_LIST_GAP = 6;
const TODO_PREVIEW_MAX = 4;
const FOOTER = 6 + 28;
const BODY_PADDING_X = 14 * 2 + 2;
// Ortalama karakter genişliği (px): başlık 16pt/800, içerik 13.5pt.
const TITLE_CHAR_W = 8.8;
const CONTENT_CHAR_W = 6.9;

/**
 * `text`in `charsPerLine` genişlikte kaç satıra sarıldığı (kelime sınırında,
 * yeni satırlar korunur). Üst sınır `maxLines`; boş metin 0 satır.
 */
export function wrappedLineCount(text, charsPerLine, maxLines = Infinity) {
  const perLine = Math.max(1, Math.floor(charsPerLine));
  const source = String(text ?? "");
  if (!source.trim()) return 0;
  let lines = 0;
  for (const paragraph of source.split(/\r?\n/)) {
    if (lines >= maxLines) break;
    let used = 0;
    let count = 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      // Satırdan uzun kelime birden çok satıra bölünür.
      let rest = word.length;
      if (used > 0 && used + 1 + rest <= perLine) {
        used += 1 + rest;
        continue;
      }
      if (used > 0) count += 1;
      while (rest > perLine) {
        count += 1;
        rest -= perLine;
      }
      used = rest;
    }
    lines += count;
  }
  return Math.min(lines, maxLines);
}

/**
 * Izgara kartının (NoteCard layout="grid") yaklaşık yüksekliği. `width` kartın
 * dış genişliği; metin genişliği buradan türetilir.
 */
export function estimateGridCardHeight(note, width) {
  const textWidth = Math.max(40, (Number(width) || 0) - BODY_PADDING_X);
  const titleLines = Math.max(
    1,
    wrappedLineCount(note?.title, textWidth / TITLE_CHAR_W, TITLE_MAX_LINES),
  );
  let height = CARD_CHROME + HEAD_ROW + titleLines * TITLE_LINE + TITLE_GAP + FOOTER;
  if (note?.scheduledDate) height += DUE_CHIP_ROW;

  if (note?.type === "todo") {
    const todos = Array.isArray(note.todos) ? note.todos : [];
    const active = todos.filter((todo) => !todo?.done);
    const shown = active.length > 0 ? active : todos;
    const rows = Math.min(shown.length, TODO_PREVIEW_MAX);
    const hidden = shown.length > rows;
    const children = rows + (hidden ? 1 : 0) + (todos.length > 0 ? 1 : 0);
    height += rows * TODO_ROW + Math.max(0, children - 1) * TODO_GAP + TODO_LIST_GAP;
    if (hidden) height += TODO_MORE;
    if (todos.length > 0) height += TODO_PROGRESS;
  } else {
    // Boş içerikte "İçerik yok" yer tutucusu bir satır kaplar.
    const contentLines = Math.max(
      1,
      wrappedLineCount(note?.content, textWidth / CONTENT_CHAR_W, CONTENT_MAX_LINES),
    );
    height += contentLines * CONTENT_LINE + CONTENT_GAP;
  }
  return height;
}

/**
 * Kartları `columnCount` sütuna dağıtır: sırayla, o ana kadar en kısa sütuna
 * (eşitlikte soldakine). Her sütun kendi içinde girdi sırasını korur; sabitlenmiş
 * (önde gelen) kartlar böylece üst sıralarda kalır.
 * @returns {Array<Array>} sütun başına kart listesi
 */
export function splitIntoColumns(items, getHeight, columnCount = 2) {
  const count = Math.max(1, columnCount);
  const columns = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);
  for (const item of Array.isArray(items) ? items : []) {
    let target = 0;
    for (let i = 1; i < count; i += 1) {
      if (heights[i] < heights[target]) target = i;
    }
    columns[target].push(item);
    heights[target] += getHeight(item);
  }
  return columns;
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
