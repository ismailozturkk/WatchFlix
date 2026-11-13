// Zevk Çemberleri Hub kartı bölüm gizle/göster kaydında, ama KAPILI: kapı kapalıyken ayar ekranında
// satırı ve sayımı yok (özelliğin varlığı sızmasın).
import { gatedSectionsOf, sectionsOf, summarizeScreen } from "../utils/sectionVisibility";

const ids = (list) => list.map((item) => item.id);

test("kapı kapalıyken match listelenmez ve sayılmaz; açıkken listelenir", () => {
  expect(ids(sectionsOf("hub"))).toContain("match");
  expect(ids(gatedSectionsOf("hub"))).not.toContain("match");
  expect(ids(gatedSectionsOf("hub", { match: true }))).toContain("match");
  const closed = summarizeScreen(null, "hub");
  const open = summarizeScreen(null, "hub", {}, { match: true });
  expect(open.total).toBe(closed.total + 1);
});

test("Hub sırası: CineSwipe'ın hemen altında", () => {
  const list = ids(sectionsOf("hub"));
  expect(list.indexOf("match")).toBe(list.indexOf("cineswipe") + 1);
});

test("gizli kaydı normalize edilirken korunur (kapı açılınca tercih geri gelir)", () => {
  const hidden = { hub: ["match"] };
  expect(summarizeScreen(hidden, "hub", {}, { match: true }).hidden).toBe(1);
  expect(summarizeScreen(hidden, "hub").hidden).toBe(0);
});
