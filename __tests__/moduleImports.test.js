// __tests__/moduleImports.test.js
//
// Yerel modüller arası import bekçisi.
//
// NEDEN: Metro, var olmayan bir ADLANDIRILMIŞ import'u derleme zamanında
// yakalamaz — değer sessizce `undefined` olur ve ancak çağrıldığı anda
// "x is not a function" diye patlar. services/postsService.js bildirim
// fonksiyonlarını (`createSocialNotification`, `notifyOnComment`) yanlış
// modülden import ediyordu: gönderi beğenme ve yorum akışları, asıl yazım
// başarılı olduktan SONRA TypeError ile düşüyor, arayüz hata gösteriyordu.
// Hiçbir ekran/render testi bu yola girmediği için fark edilmedi.
//
// KAPSAM: göreli (`./`, `../`) ve takma ad (`@utils/...`) import / re-export
// bildirimleri. Dosya var mı + `{ ad }` hedefte dışa aktarılıyor mu + varsayılan
// import için `export default` var mı. Hedef CommonJS ise (dışa aktarım
// çıkarılamaz) o dosya atlanır. Paket (node_modules) import'ları kapsam dışı.

const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const KOK = path.join(__dirname, "..");
const TARANAN = ["screens", "components", "context", "hooks", "services", "utils", "theme", "data"];
const TEK_DOSYALAR = ["App.js", "index.js", "firebase.js"];
const UZANTILAR = [".js", ".jsx", ".json", ".ts", ".tsx"];
const TAKMA_AD = {
  "@components": "components", "@context": "context", "@screens": "screens", "@services": "services",
  "@hooks": "hooks", "@utils": "utils", "@assets": "assets", "@theme": "theme",
  "@translations": "translations", "@lottie": "assets/lottie",
};

const jsDosyalari = (klasor, toplam = []) => {
  if (!fs.existsSync(klasor)) return toplam;
  for (const girdi of fs.readdirSync(klasor, { withFileTypes: true })) {
    const yol = path.join(klasor, girdi.name);
    if (girdi.isDirectory()) {
      if (girdi.name !== "node_modules" && girdi.name !== "__tests__") jsDosyalari(yol, toplam);
    } else if (/\.jsx?$/.test(girdi.name)) {
      toplam.push(yol);
    }
  }
  return toplam;
};

const goreli = (yol) => path.relative(KOK, yol).split(path.sep).join("/");

const onbellek = new Map();
const ayristir = (dosya) => {
  if (onbellek.has(dosya)) return onbellek.get(dosya);
  let sonuc = null;
  try {
    const kod = fs.readFileSync(dosya, "utf8");
    sonuc = parser.parse(kod, { sourceType: "unambiguous", plugins: ["jsx", "classProperties"], errorRecovery: true }).program.body;
  } catch {
    sonuc = null;
  }
  onbellek.set(dosya, sonuc);
  return sonuc;
};

const coz = (spec, kaynak) => {
  let taban;
  if (spec.startsWith(".")) taban = path.resolve(path.dirname(kaynak), spec);
  else if (TAKMA_AD[spec.split("/")[0]]) {
    const [ad, ...kalan] = spec.split("/");
    taban = path.join(KOK, TAKMA_AD[ad], ...kalan);
  } else return { paket: true };
  const adaylar = [taban, ...UZANTILAR.map((u) => taban + u), ...UZANTILAR.map((u) => path.join(taban, "index" + u))];
  const bulunan = adaylar.find((a) => fs.existsSync(a) && fs.statSync(a).isFile());
  return bulunan ? { dosya: bulunan } : { eksik: taban };
};

const adIsle = (d, kume) => {
  if (!d) return;
  if (d.type === "Identifier") kume.add(d.name);
  else if (d.type === "ObjectPattern") d.properties.forEach((p) => adIsle(p.value || p.argument, kume));
  else if (d.type === "ArrayPattern") d.elements.forEach((p) => adIsle(p, kume));
  else if (d.type === "AssignmentPattern") adIsle(d.left, kume);
  else if (d.type === "RestElement") adIsle(d.argument, kume);
};

const disaAktarimlar = (dosya, gorulen = new Set()) => {
  const sonuc = { adlar: new Set(), varsayilan: false, bilinmiyor: false };
  if (/\.json$/.test(dosya) || gorulen.has(dosya)) return { ...sonuc, bilinmiyor: true };
  gorulen.add(dosya);
  const govde = ayristir(dosya);
  if (!govde) return { ...sonuc, bilinmiyor: true };
  let esm = false;
  for (const n of govde) {
    if (n.type === "ExportNamedDeclaration") {
      esm = true;
      if (n.declaration) {
        if (n.declaration.id) sonuc.adlar.add(n.declaration.id.name);
        (n.declaration.declarations || []).forEach((x) => adIsle(x.id, sonuc.adlar));
      }
      for (const s of n.specifiers || []) {
        const ad = s.exported.name || s.exported.value;
        if (ad === "default") sonuc.varsayilan = true;
        else sonuc.adlar.add(ad);
      }
    } else if (n.type === "ExportDefaultDeclaration") {
      esm = true;
      sonuc.varsayilan = true;
    } else if (n.type === "ExportAllDeclaration") {
      esm = true;
      const hedef = coz(n.source.value, dosya);
      if (hedef.dosya) {
        const alt = disaAktarimlar(hedef.dosya, gorulen);
        alt.adlar.forEach((a) => sonuc.adlar.add(a));
        if (alt.bilinmiyor) sonuc.bilinmiyor = true;
      } else sonuc.bilinmiyor = true;
    }
  }
  if (!esm) sonuc.bilinmiyor = true; // CommonJS: dışa aktarım statik çıkarılamaz
  return sonuc;
};

describe("yerel modül import'ları", () => {
  const dosyalar = [...TARANAN.flatMap((k) => jsDosyalari(path.join(KOK, k))), ...TEK_DOSYALAR.map((d) => path.join(KOK, d))];

  it("taranacak dosya bulunur", () => {
    expect(dosyalar.length).toBeGreaterThan(300);
  });

  it("her import hedefi var ve istenen adlar dışa aktarılıyor", () => {
    const sorunlar = [];
    for (const dosya of dosyalar) {
      const govde = ayristir(dosya);
      if (!govde) {
        sorunlar.push(`${goreli(dosya)}: ayrıştırılamadı`);
        continue;
      }
      for (const n of govde) {
        let spec;
        const adlar = [];
        let varsayilan = false;
        if (n.type === "ImportDeclaration") {
          spec = n.source.value;
          for (const s of n.specifiers) {
            if (s.type === "ImportSpecifier") adlar.push(s.imported.name || s.imported.value);
            else if (s.type === "ImportDefaultSpecifier") varsayilan = true;
          }
        } else if ((n.type === "ExportNamedDeclaration" || n.type === "ExportAllDeclaration") && n.source) {
          spec = n.source.value;
          if (n.type === "ExportNamedDeclaration") {
            for (const s of n.specifiers) {
              if (s.local.name === "default") varsayilan = true;
              else adlar.push(s.local.name);
            }
          }
        } else continue;

        const hedef = coz(spec, dosya);
        if (hedef.paket) continue;
        if (hedef.eksik) {
          sorunlar.push(`${goreli(dosya)}:${n.loc.start.line}: dosya yok '${spec}'`);
          continue;
        }
        if (!/\.jsx?$/.test(hedef.dosya)) continue;
        const ex = disaAktarimlar(hedef.dosya);
        if (ex.bilinmiyor) continue;
        for (const ad of adlar) {
          if (!ex.adlar.has(ad)) sorunlar.push(`${goreli(dosya)}:${n.loc.start.line}: '${ad}' ${spec} içinde dışa aktarılmıyor`);
        }
        if (varsayilan && !ex.varsayilan) sorunlar.push(`${goreli(dosya)}:${n.loc.start.line}: '${spec}' içinde export default yok`);
      }
    }
    expect(sorunlar).toEqual([]);
  });
});
