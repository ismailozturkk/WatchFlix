// "Basınca büyüyen cam kesilmesin" bekçisi (kaynak taraması).
//
// iOS 26 etkileşimli cam dokununca kutusunun dışına esner; kırpan kap (ScrollView /
// FlatList, overflow: "hidden") kenarındaki cam düğmeyi o an keser. Pay sabiti:
// utils/liquidGlass GLASS_PRESS_ROOM. Tarama kuralları: __tests__/helpers/glassPressRoomScan.js.
const { GLASS_PRESS_ROOM } = require("../utils/liquidGlass");
const { horizontalGlassRows, selfClippingGlassButtons, sheetStyle } = require("./helpers/glassPressRoomScan");

// Dikey payı GLASS_PRESS_ROOM'dan az kalmasına izin verilen yatay satırlar (dosya → gerekçe).
const LOW_ROOM_ALLOWED = {
  // Kaldır rozeti küçük afişin yalnız ÜST köşesinde; üstte taşma + pay var, altta cam yok.
  "screens/chat/ChatScreen.js": "rozet yalnız üstte",
  // Yalnız __DEV__ zaman makinesi şeridi.
  "screens/tournament/TournamentScreen.js": "yalnız __DEV__",
};

describe("cam basma payı", () => {
  test("pay en az 8 pt", () => {
    expect(GLASS_PRESS_ROOM).toBeGreaterThanOrEqual(8);
  });

  test("cam düğmeli yatay satırların içerik kabında üstte/altta GLASS_PRESS_ROOM var", () => {
    const rows = horizontalGlassRows(GLASS_PRESS_ROOM);
    expect(rows.length).toBeGreaterThan(20); // tarayıcı gerçekten satır buluyor
    const low = rows
      .filter((r) => r.room < GLASS_PRESS_ROOM && !LOW_ROOM_ALLOWED[r.rel])
      .map((r) => `${r.rel}:${r.line} (dikey pay ${r.room})`);
    expect(low).toEqual([]);
  });

  test("cam düğme kendi stilinde koşulsuz overflow:hidden taşımaz", () => {
    const clipped = selfClippingGlassButtons(GLASS_PRESS_ROOM).map((r) => `${r.rel}:${r.line} ${r.name}`);
    expect(clipped).toEqual([]);
  });

  test("ortak raf çip satırı ve alt sayfa kaydırıcısı payı kendisi açar", () => {
    const rail = sheetStyle("components/home/SectionChips.js", "styles", "rail", GLASS_PRESS_ROOM);
    const railContent = sheetStyle("components/home/SectionChips.js", "styles", "railContent", GLASS_PRESS_ROOM);
    expect(rail.marginVertical).toBe(-GLASS_PRESS_ROOM);
    expect(railContent.paddingVertical).toBe(GLASS_PRESS_ROOM);

    const sheetScroll = sheetStyle("components/common/SheetScroll.js", "styles", "scroll", GLASS_PRESS_ROOM);
    expect(sheetScroll.marginHorizontal).toBe(-GLASS_PRESS_ROOM);
  });
});
