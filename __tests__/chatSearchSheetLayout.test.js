// Sohbetteki "#" Film & Dizi Ara sayfasının yerleşim bekçisi (kaynak taraması).
// Yerleşim cihazda Yoga ile çözülür; jest'te çizilemediği için kritik stiller
// kaynaktan denetlenir.
import fs from "fs";
import path from "path";

test("film-dizi araması seçilenleri ayrı panelde ve küçülebilen düzende tutar", () => {
  const source = fs.readFileSync(path.join(__dirname, "../screens/chat/ChatScreen.js"), "utf8");

  expect(source).toMatch(/sheetStyle=\{\[\s*styles\.searchModal/);
  expect(source).toContain("style={styles.searchResultsList}");
  expect(source).toContain("columnWrapperStyle={styles.searchGridRow}");
  expect(source).toContain("style={styles.composeTrayScroll}");
  expect(source).toContain('i18nText("autoI18n.secilenler", "Seçilenler")');
  expect(source).toContain("showSelectedPanel && selectedItems.length > 0");
  // Sonuçların altındaki seçim çubuğu paneli açar, panel başlığındaki geri düğmesi kapatır.
  expect(source).toContain("!showSelectedPanel && selectedItems.length > 0");
  expect(source.match(/onPress=\{toggleSelectedPanel\}/g) || []).toHaveLength(2);
  // Liste bölgesi flex:1 OLAMAZ: SheetScroll'un flexGrow:0'ı ile basis 0 kalır,
  // seçilenler 0 yüksekliğe çöküyordu.
  const scrollStyle = source.match(/composeTrayScroll:\s*\{[^}]*\}/)?.[0] || "";
  expect(scrollStyle).toMatch(/flexGrow:\s*1/);
  expect(scrollStyle).not.toMatch(/\bflex:\s*1/);
  expect(source).not.toMatch(/SCREEN_HEIGHT\s*\*\s*\(selectedItems\.length/);
});

test("arama TMDB'ye include_adult yazmaz (utils/tmdbAdultGuard uygular)", () => {
  const source = fs.readFileSync(path.join(__dirname, "../screens/chat/ChatScreen.js"), "utf8");
  expect(source).not.toMatch(/include_adult\s*:/);
});
