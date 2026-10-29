// services/import/importErrors.js
//
// İçe aktarma servislerinin hata türü. Servis kullanıcıya metin vermez; yalnız `code` taşır,
// arayüz (components/import/importCopy.js → importErrorText) kodu kullanıcının dilindeki
// cümleye çevirir. `message` yalnız geliştirici günlüğü içindir (İngilizce).

export const IMPORT_ERROR_CODES = Object.freeze({
  notLetterboxdCsv: "notLetterboxdCsv",
  notImdbCsv: "notImdbCsv",
  noBundle: "noBundle",
  noBundleItems: "noBundleItems",
  zipNoCsv: "zipNoCsv",
  zipTooLarge: "zipTooLarge",
  emptyHeaders: "emptyHeaders",
  unrecognizedCsv: "unrecognizedCsv",
  noItemsInFile: "noItemsInFile",
  noTmdbMatch: "noTmdbMatch",
  zipOpen: "zipOpen",
  // Aktarım sırasında: kullanıcı durdurdu / bağlantı koptu / TMDB erişilemez /
  // art arda kayıt hatası. Hepsinde tamamlanan kayıtlar korunur, iş kaldığı yerden sürer.
  cancelled: "cancelled",
  network: "network",
  tmdbUnavailable: "tmdbUnavailable",
  saveInterrupted: "saveInterrupted",
});

export class ImportError extends Error {
  /**
   * @param {keyof typeof IMPORT_ERROR_CODES} code
   * @param {string} message  geliştirici günlüğü için (kullanıcıya gösterilmez)
   */
  constructor(code, message) {
    super(message || code);
    this.name = "ImportError";
    this.code = code;
  }
}

export const isCancelledImport = (error) => error?.code === IMPORT_ERROR_CODES.cancelled;
