// __tests__/settingsBackupFiles.test.js
//
// Platform G/Ç sözleşmesi: dosyaya yaz + paylaş, panoya kopyala, dosya seç, panodan
// oku. Native modüller taklit (jest node ortamında yüklenemezler); dosya sistemi
// kök __mocks__'taki bellek-içi sürüm. ASIL kanıt: hiçbir yol FIRLATMAZ — her hata
// bir kod olarak döner, ekran onu kullanıcıya çevirir.

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "1.4.9" } } }));
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
  getStringAsync: jest.fn(),
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

const FileSystem = require("expo-file-system");
const Clipboard = require("expo-clipboard");
const DocumentPicker = require("expo-document-picker");
const Sharing = require("expo-sharing");
const { Keys, set } = require("../services/storage");
const { getStore } = require("../services/storage/instances");
const {
  exportToClipboard,
  exportToFile,
  pickBackupFile,
  readClipboardBackup,
} = require("../services/settingsBackupFiles");
const {
  BACKUP_FORMAT,
  MAX_BACKUP_CHARS,
  buildBackup,
  serializeBackup,
} = require("../utils/settingsBackup");

const gecerliMetin = () => serializeBackup(buildBackup(() => null));

beforeEach(() => {
  getStore("settings").clearAll();
  FileSystem.__reset();
  jest.clearAllMocks();
  Sharing.isAvailableAsync.mockImplementation(() => Promise.resolve(true));
  Sharing.shareAsync.mockImplementation(() => Promise.resolve());
  Clipboard.setStringAsync.mockImplementation(() => Promise.resolve(true));
});

describe("exportToFile", () => {
  test("yedeği önbellek klasörüne yazar ve paylaşım sayfasını açar", async () => {
    set(Keys.theme, "dark");
    set(Keys.customThemes, [{ id: "a", name: "Okyanus", tokens: { primary: "#0B0D12" } }]);

    const sonuc = await exportToFile({ dialogTitle: "Ayarları kaydet" });
    expect(sonuc.ok).toBe(true);
    expect(sonuc.fileName).toMatch(/^seelogd-ayarlar-\d{4}-\d{2}-\d{2}\.json$/);

    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    const [uri, secenekler] = Sharing.shareAsync.mock.calls[0];
    expect(uri).toBe(`/cache/${sonuc.fileName}`);
    expect(secenekler).toMatchObject({ mimeType: "application/json", UTI: "public.json", dialogTitle: "Ayarları kaydet" });

    // dosyanın içeriği gerçek bir yedek: ayar + özel tema + uygulama bilgisi
    const icerik = JSON.parse(new FileSystem.File(uri).textSync());
    expect(icerik.format).toBe(BACKUP_FORMAT);
    expect(icerik.settings.theme).toBe("dark");
    expect(icerik.settings.customThemes).toHaveLength(1);
    expect(icerik.app).toEqual({ version: "1.4.9", platform: "ios" });
  });

  test("aynı gün ikinci dışa aktarma eski dosyanın ÜZERİNE yazar", async () => {
    set(Keys.theme, "dark");
    await exportToFile();
    set(Keys.theme, "purple");
    const sonuc = await exportToFile();
    const icerik = JSON.parse(new FileSystem.File(`/cache/${sonuc.fileName}`).textSync());
    expect(icerik.settings.theme).toBe("purple");
  });

  test("paylaşım kullanılamıyorsa kod döner (fırlatmaz)", async () => {
    Sharing.isAvailableAsync.mockImplementation(() => Promise.resolve(false));
    expect(await exportToFile()).toEqual({ ok: false, error: "sharing-unavailable" });
  });

  test("paylaşım sayfası hata verirse kod döner", async () => {
    Sharing.shareAsync.mockImplementation(() => Promise.reject(new Error("iptal")));
    expect(await exportToFile()).toEqual({ ok: false, error: "sharing-unavailable" });
  });

  test("dosya yazılamazsa write-failed", async () => {
    const orijinal = FileSystem.File.prototype.write;
    FileSystem.File.prototype.write = () => {
      throw new Error("disk dolu");
    };
    try {
      expect(await exportToFile()).toEqual({ ok: false, error: "write-failed" });
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    } finally {
      FileSystem.File.prototype.write = orijinal;
    }
  });
});

describe("exportToClipboard", () => {
  test("yedek metni panoya gider", async () => {
    set(Keys.haptics, true);
    expect(await exportToClipboard()).toEqual({ ok: true });
    const metin = Clipboard.setStringAsync.mock.calls[0][0];
    expect(JSON.parse(metin).settings.haptics).toBe(true);
  });

  test("pano hatasında kod döner", async () => {
    Clipboard.setStringAsync.mockImplementation(() => Promise.reject(new Error("izin yok")));
    expect(await exportToClipboard()).toEqual({ ok: false, error: "clipboard-failed" });
  });
});

describe("pickBackupFile", () => {
  const dosyaVer = (icerik, ek = {}) => {
    const uri = "/cache/secilen.json";
    new FileSystem.File(uri).write(icerik);
    DocumentPicker.getDocumentAsync.mockImplementation(() =>
      Promise.resolve({ canceled: false, assets: [{ uri, name: "secilen.json", size: icerik.length, ...ek }] }),
    );
  };

  test("geçerli dosya: ayrıştırılmış yedek + dosya adı", async () => {
    dosyaVer(gecerliMetin());
    const sonuc = await pickBackupFile();
    expect(sonuc.ok).toBe(true);
    expect(sonuc.backup.format).toBe(BACKUP_FORMAT);
    expect(sonuc.fileName).toBe("secilen.json");
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith(
      expect.objectContaining({ copyToCacheDirectory: true, multiple: false }),
    );
  });

  test("iptal", async () => {
    DocumentPicker.getDocumentAsync.mockImplementation(() => Promise.resolve({ canceled: true, assets: null }));
    expect(await pickBackupFile()).toEqual({ ok: false, cancelled: true });
  });

  test.each([
    ["JSON olmayan dosya", "merhaba dünya", "not-json"],
    ["başka JSON", JSON.stringify({ a: 1 }), "not-backup"],
    ["boş dosya", "   ", "empty"],
    ["daha yeni sürüm", JSON.stringify({ format: BACKUP_FORMAT, version: 99, settings: {} }), "too-new"],
  ])("%s → %s", async (_ad, icerik, hata) => {
    dosyaVer(icerik);
    const sonuc = await pickBackupFile();
    expect(sonuc.ok).toBe(false);
    expect(sonuc.error).toBe(hata);
  });

  test("devasa dosya bellete alınmadan reddedilir", async () => {
    dosyaVer("{}", { size: MAX_BACKUP_CHARS * 5 });
    expect(await pickBackupFile()).toEqual({ ok: false, error: "too-large" });
  });

  test("seçici hata verirse / dosya okunamazsa read-failed", async () => {
    DocumentPicker.getDocumentAsync.mockImplementation(() => Promise.reject(new Error("izin")));
    expect(await pickBackupFile()).toEqual({ ok: false, error: "read-failed" });

    DocumentPicker.getDocumentAsync.mockImplementation(() =>
      Promise.resolve({ canceled: false, assets: [{ uri: "/cache/yok.json", name: "yok.json" }] }),
    );
    expect(await pickBackupFile()).toEqual({ ok: false, error: "read-failed" });

    DocumentPicker.getDocumentAsync.mockImplementation(() => Promise.resolve({ canceled: false, assets: [] }));
    expect(await pickBackupFile()).toEqual({ ok: false, error: "read-failed" });
  });
});

describe("readClipboardBackup", () => {
  test("pano geçerli yedek içeriyorsa ayrıştırır", async () => {
    Clipboard.getStringAsync.mockImplementation(() => Promise.resolve(gecerliMetin()));
    const sonuc = await readClipboardBackup();
    expect(sonuc.ok).toBe(true);
  });

  test("boş pano / başka metin", async () => {
    Clipboard.getStringAsync.mockImplementation(() => Promise.resolve(""));
    expect(await readClipboardBackup()).toEqual({ ok: false, error: "empty" });
    Clipboard.getStringAsync.mockImplementation(() => Promise.resolve("alışveriş listesi"));
    expect(await readClipboardBackup()).toEqual({ ok: false, error: "not-json" });
  });

  test("pano okunamazsa kod döner", async () => {
    Clipboard.getStringAsync.mockImplementation(() => Promise.reject(new Error("izin")));
    expect(await readClipboardBackup()).toEqual({ ok: false, error: "clipboard-failed" });
  });
});
