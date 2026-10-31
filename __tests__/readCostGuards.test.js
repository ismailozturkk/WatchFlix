// Okuma maliyeti bekçileri (docs/maliyet/KULLANIM_VE_MALIYET_ANALIZI_2026-11-01.md, Aşama 1).
// Kaynak düzeyinde: davranış testleri postsLiveFeed.test.js'te; buradakiler geri dönüşü yakalar.
const fs = require("fs");
const path = require("path");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

test("film/dizi yorum dinleyicisi sınırsız değil (sayfalı)", () => {
  const src = read("components/Comment.js");
  const listener = src.slice(src.indexOf("Comments listener (sayfalı)"));
  expect(listener).toMatch(/collection\(db, collectionName, cid, "comments"\),\s*orderBy\("timestamp", "desc"\),\s*limit\(commentLimit\)/);
  expect(src).toMatch(/const COMMENT_PAGE = 20;/);
  expect(src).toMatch(/const COMMENT_SCOPE_FILL_MAX = \d+;/);
});

test("akış dinleyicisi yalnız canlı akış talebi varken kurulur", () => {
  const src = read("context/PostsContext.js");
  expect(src).toMatch(/if \(!startupReady \|\| !liveActive \|\| filter !== "all" \|\| sort !== "recent"\)/);
  // Açılışta ağdan ilk sayfa çekilmez (dinleyiciden gelir).
  const coldStart = src.slice(src.indexOf("1. Cold start"), src.indexOf("2. Realtime listener"));
  expect(coldStart).not.toMatch(/fetchFeed/);
});

test("sohbet ekranı çevrimiçi / yazıyor sinyali okumuyor ve yazmıyor", () => {
  const src = read("screens/chat/ChatScreen.js");
  expect(src).not.toMatch(/subscribeChatMeta|setTyping|createTypingController|isOnlineVisible/);
  // Push susturma bayrağı (görünmez) kalır.
  expect(src).toMatch(/enterChat\(chatId, currentUser\.uid\)/);
  const header = read("components/chat/ChatHeader.js");
  expect(header).not.toMatch(/formatLastSeen|TypingDots|chat_typing/);
});
