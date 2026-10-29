// services/import/csvParser.js
//
// Sıfır bağımlılıklı, RFC 4180 uyumlu, yüksek performanslı ve akıllı ayırıcı tespit eden CSV ayrıştırıcı.
// Tırnak içi virgülleri, çift tırnak kaçışlarını (""), çok satırlı alanları,
// UTF-8 BOM önekini (\uFEFF) ve HTML kaçış karakterlerini (&amp;) eksiksiz işler.

/**
 * HTML karakter varlıklarını temizler (&amp; -> &, &#39; -> ', &quot; -> ").
 * @param {string} str
 * @returns {string}
 */
export function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Metnin ilk satırına bakarak ayırıcıyı (virgül, noktalı virgül, tab) otomatik tespit eder.
 * @param {string} text
 * @returns {string}
 */
export function detectDelimiter(text) {
  if (!text) return ",";
  // Yalnız ilk satır: büyük dışa aktarımlarda tüm metni satırlara bölmek gereksiz bellek.
  const lineEnd = text.search(/[\r\n]/);
  const firstLine = lineEnd === -1 ? text : text.slice(0, lineEnd);
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semicolonCount > commaCount && semicolonCount > tabCount) return ";";
  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
  return ",";
}

/**
 * Ham CSV metnini satır ve sütun dizilerine ayrıştırır.
 * @param {string} text - Ham CSV içeriği
 * @param {string|null} customDelimiter - İsteğe bağlı ayırıcı (varsayılan: otomatik tespit)
 * @returns {string[][]} Satırlar ve hücreler
 */
export function parseCsvRows(text, customDelimiter = null) {
  if (!text || typeof text !== "string") return [];

  // UTF-8 BOM temizliği
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const delimiter = customDelimiter || detectDelimiter(cleanText);

  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;
  const len = cleanText.length;

  for (let i = 0; i < len; i++) {
    const char = cleanText[i];
    const nextChar = i + 1 < len ? cleanText[i + 1] : "";

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Kaçış yapılmış tırnak ("")
          currentCell += '"';
          i++; // bir sonraki tırnağı atla
        } else {
          // Tırnak kapanışı
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(decodeHtmlEntities(currentCell.trim()));
        currentCell = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++; // CRLF sonunu atla
        }
        currentRow.push(decodeHtmlEntities(currentCell.trim()));
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(decodeHtmlEntities(currentCell.trim()));
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  // Son hücre/satır eklemesi
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(decodeHtmlEntities(currentCell.trim()));
    rows.push(currentRow);
  }

  return rows.filter((row) => row.length > 0 && row.some((c) => c.length > 0));
}

/**
 * Yalnız başlık satırını (küçük harfli) okur — dosya türünü tanımak için tüm dosyayı
 * ayrıştırmaya gerek yok.
 * @param {string} text
 * @returns {string[]}
 */
export function parseCsvHeaders(text) {
  if (!text || typeof text !== "string") return [];
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lineEnd = clean.search(/[\r\n]/);
  const firstLine = lineEnd === -1 ? clean : clean.slice(0, lineEnd);
  const [row] = parseCsvRows(firstLine);
  return (row || []).map((cell) => cell.trim().toLowerCase());
}

/**
 * Başlık satırını kullanarak CSV'yi nesne dizisine (Array of Objects) çevirir.
 * @param {string} text - Ham CSV içeriği
 * @param {string|null} customDelimiter - İsteğe bağlı ayırıcı
 * @returns {{ headers: string[], data: Record<string, string>[] }}
 */
export function parseCsv(text, customDelimiter = null) {
  const rows = parseCsvRows(text, customDelimiter);
  if (!rows || rows.length < 2) {
    return { headers: [], data: [] };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const item = {};
    for (let j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j] ?? "";
    }
    data.push(item);
  }

  return { headers, data };
}
