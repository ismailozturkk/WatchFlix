// Statik görsel/medya require'ları gerçek dosyaya çözülmeli.
//
// NEDEN: Metro bir `require("../assets/x.png")` çözülemezse TÜM uygulama paketi
// düşer — ama bunu yalnız bundle alınca (yani cihazda/derlemede) görürsün.
// assets/icon.png ve assets/android-icon-foreground.png assets/icon_default/
// altına taşındığında 10 çağrı yeri eski yolda kalmıştı; jest bunu yakalamıyordu.
// Bu test o sınıfı birim test hızına çeker.
//
// KAPSAM: yalnız string literal'li, yerel (göreli ya da `@assets/` takma adlı)
// medya require'ları. Değişkenle kurulan yollar (`require(`./${x}.png`)`) ve
// paket (node_modules) importları regex ile çözülemez, atlanır.

const fs = require("fs");
const path = require("path");

const KOK = path.join(__dirname, "..");
const TARANAN = ["screens", "components", "context", "services", "utils", "hooks", "data", "theme"];
const TARANAN_DOSYALAR = ["App.js", "index.js"];

const MEDYA = "png|jpe?g|webp|gif|svg|mp4|mov|lottie|ttf|otf";
const REQUIRE = new RegExp(`require\\(\\s*(["'])([^"'\`$]+\\.(?:${MEDYA}))\\1\\s*\\)`, "g");
const IMPORT = new RegExp(`from\\s+(["'])([^"'\`$]+\\.(?:${MEDYA}))\\1`, "g");

function jsDosyalari(klasor, toplam = []) {
  if (!fs.existsSync(klasor)) return toplam;
  for (const girdi of fs.readdirSync(klasor, { withFileTypes: true })) {
    const tamYol = path.join(klasor, girdi.name);
    if (girdi.isDirectory()) {
      if (girdi.name === "node_modules" || girdi.name === "__tests__") continue;
      jsDosyalari(tamYol, toplam);
    } else if (/\.(js|jsx|ts|tsx)$/.test(girdi.name)) {
      toplam.push(tamYol);
    }
  }
  return toplam;
}

const dosyalar = [
  ...TARANAN.flatMap((k) => jsDosyalari(path.join(KOK, k))),
  ...TARANAN_DOSYALAR.map((d) => path.join(KOK, d)).filter((d) => fs.existsSync(d)),
];

function coz(dosya, belirtec) {
  if (belirtec.startsWith("@assets/")) return path.join(KOK, "assets", belirtec.slice("@assets/".length));
  if (belirtec.startsWith("@lottie/")) return path.join(KOK, "assets", "lottie", belirtec.slice("@lottie/".length));
  if (belirtec.startsWith(".")) return path.resolve(path.dirname(dosya), belirtec);
  return null; // başka takma ad / paket: kapsam dışı
}

const eksikler = [];
let kontrolEdilen = 0;
for (const dosya of dosyalar) {
  const kaynak = fs.readFileSync(dosya, "utf8");
  for (const desen of [REQUIRE, IMPORT]) {
    desen.lastIndex = 0;
    let m;
    while ((m = desen.exec(kaynak))) {
      const hedef = coz(dosya, m[2]);
      if (!hedef) continue;
      kontrolEdilen += 1;
      if (!fs.existsSync(hedef)) {
        eksikler.push(`${path.relative(KOK, dosya).split(path.sep).join("/")} → ${m[2]}`);
      }
    }
  }
}

test("tarama gerçekten bir şey buluyor (regex sessizce boşa düşmesin)", () => {
  expect(kontrolEdilen).toBeGreaterThan(50);
});

test("her statik medya require'ı diskte var olan bir dosyaya çözülür", () => {
  expect(eksikler).toEqual([]);
});
