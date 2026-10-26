// Arkadaşlıktan çıkarma tek kapıdan geçer: services/friendsService.unfriend
// (arkadaşlık + iki taraftaki friendsCount + 1-1 sohbet temizliği).
//
// T3 B13: Arkadaşlar listesi friends belgelerini kendisi siliyordu; onay
// "sohbet de silinir" dediği halde sohbet ve sayaç kalıyordu. Ekran/bileşen
// katmanında friends belgesine doğrudan silme yazılmasın.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCAN = ["screens", "components", "context", "hooks"];
const DIRECT_DELETE = /deleteDoc\(\s*doc\(\s*db\s*,\s*["']Users["'][^)]*["']friends["']/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

test("ekran katmanı friends belgesini doğrudan silmez", () => {
  const offenders = SCAN.flatMap((d) => walk(path.join(ROOT, d)))
    .filter((file) => DIRECT_DELETE.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(ROOT, file));
  expect(offenders).toEqual([]);
});

test("Arkadaşlar listesi ortak unfriend'i kullanır", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "screens/tabs/profile/FriendsListScreen.js"),
    "utf8",
  );
  expect(src).toMatch(/import \{ unfriend \} from "..\/..\/..\/services\/friendsService"/);
  expect(src).toMatch(/await unfriend\(user\.uid, friend\.uid\)/);
});
