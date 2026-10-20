// Widget ayar ekranının SAF modelleri: platform farkı tablosu ve örnek veri.
// Bu sayılar native koddaki sabitlerle birebir eşleşmek zorunda; native kod
// değişirse (Swift ölçüleri, Android hücre oranları) bu test kırılsın ki
// önizleme sessizce yalan söylemesin.

import fs from "fs";
import path from "path";
import {
  ANDROID_ASPECT,
  IOS_FAMILIES,
  IOS_FAMILY_SIZE,
  IOS_STATS_MEDIUM,
  IOS_STATS_SCALE,
  IOS_SYSTEM_MARGIN,
  fitRows,
  fitScale,
  iosContentHeight,
  iosFamilyFor,
  iosListMetrics,
  iosReminderMetrics,
  iosReminderRowHeight,
  iosStatsMediumPlan,
  widgetAspect,
  widgetCapabilities,
  widgetNaturalWidth,
} from "../screens/tabs/settings/widgets/widgetPlatform";
import {
  buildListSamples,
  buildReminderSamples,
  countdownLabel,
  shortDate,
} from "../screens/tabs/settings/widgets/widgetSamples";

const KOK = path.join(__dirname, "..");
const oku = (...parcalar) => fs.readFileSync(path.join(KOK, ...parcalar), "utf8");
const swift = (dosya) => oku("targets", "reminder-widget", dosya);

// Swift'te her profil tek satırda ve SIRAYLA yazılı: büyük/kompakt, büyük/rahat,
// orta/kompakt, orta/rahat.
const PROFILLER = [
  { family: "large", compact: true },
  { family: "large", compact: false },
  { family: "medium", compact: true },
  { family: "medium", compact: false },
];

describe("iOS ölçüleri Swift kaynağıyla aynı", () => {
  it("Yaklaşanlar: ReminderMetrics dört profili", () => {
    const eslesmeler = [
      ...swift("index.swift").matchAll(
        /ReminderMetrics\(badge: (\d+), divider: (true|false), icon: (\d+), padV: (\d+), gap: (\d+), title: (\d+), meta: (\d+), textBlock: (\d+)\)/g,
      ),
    ];
    expect(eslesmeler).toHaveLength(4);
    eslesmeler.forEach((m, i) => {
      const js = iosReminderMetrics(PROFILLER[i]);
      expect([
        js.badge,
        js.divider,
        js.icon,
        js.padV,
        js.gap,
        js.title,
        js.meta,
        js.textBlock,
      ]).toEqual([
        Number(m[1]),
        m[2] === "true",
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
        Number(m[7]),
        Number(m[8]),
      ]);
    });
  });

  it("Listelerim: ListMetrics dört profili", () => {
    const eslesmeler = [
      ...swift("lists-widget.swift").matchAll(
        /ListMetrics\(badge: (\d+), circle: (\d+), padV: (\d+), gap: (\d+), font: (\d+), line: (\d+)\)/g,
      ),
    ];
    expect(eslesmeler).toHaveLength(4);
    eslesmeler.forEach((m, i) => {
      const js = iosListMetrics(PROFILLER[i]);
      expect([js.badge, js.circle, js.padV, js.gap, js.font, js.line]).toEqual(
        m.slice(1, 7).map(Number),
      );
    });
  });

  it("İstatistikler: StatsScale ve orta boy bütçesi", () => {
    const kaynak = swift("stats-widget.swift");
    const olcek = (ad) => {
      const m = new RegExp(
        `static let ${ad} = StatsScale\\(\\s*countValue: (\\d+), countLabel: (\\d+), unitValue: (\\d+), unitLabel: (\\d+),\\s*durationValue: (\\d+), durationLabel: (\\d+), durationIcon: (\\d+), panelPadV: (\\d+)`,
      ).exec(kaynak);
      expect(m).not.toBeNull();
      return m.slice(1, 9).map(Number);
    };
    const sirali = (s) => [
      s.countValue,
      s.countLabel,
      s.unitValue,
      s.unitLabel,
      s.durationValue,
      s.durationLabel,
      s.durationIcon,
      s.panelPadV,
    ];
    expect(sirali(IOS_STATS_SCALE.large)).toEqual(olcek("large"));
    expect(sirali(IOS_STATS_SCALE.medium)).toEqual(olcek("medium"));

    const butce = {};
    for (const m of kaynak.matchAll(/static let (title|bothCards|wideCard|strip|gap): CGFloat = (\d+)/g)) {
      butce[m[1]] = Number(m[2]);
    }
    expect(butce).toEqual({ ...IOS_STATS_MEDIUM });
  });

  it("fitRows formülü ve widget aileleri Swift'te aynı", () => {
    const paylasilan = swift("shared.swift");
    expect(paylasilan).toMatch(/let capacity = body >= row \? Int\(\(\(body \+ gap\) \/ \(row \+ gap\)\)\.rounded\(\.down\)\) : 0/);
    expect(paylasilan).toMatch(/let rows = max\(1, min\(wanted, capacity\)\)/);
    expect(paylasilan).toMatch(/showsOverflow: total > rows && body - used >= gap \+ overflowLabel/);
    // Üç widget da orta + büyük.
    for (const dosya of ["index.swift", "lists-widget.swift", "stats-widget.swift"]) {
      expect(swift(dosya)).toMatch(/supportedFamilies\(\[\.systemMedium, \.systemLarge\]\)/);
    }
    // Sistem kenar boşluğu iki kez uygulanmamalı: elle dolgu yalnız iOS < 17.
    expect(paylasilan).toMatch(/func widgetContentPadding/);
    for (const dosya of ["index.swift", "lists-widget.swift", "stats-widget.swift"]) {
      expect(swift(dosya)).toMatch(/\.widgetContentPadding\(/);
      expect(swift(dosya)).not.toMatch(/\.padding\(\s*(entry\.preferences\.statsCompact|13|14)/);
    }
  });
});

describe("satır sığdırma (fitRows)", () => {
  const ortaRahat = iosReminderMetrics({ family: "medium", compact: false });
  const ortaBoy = iosContentHeight(IOS_FAMILY_SIZE.medium.height);

  it("iOS 17+ sistem kenar boşluğu çerçeveden düşülür", () => {
    expect(IOS_SYSTEM_MARGIN).toBe(16);
    expect(ortaBoy).toBe(158 - 32);
    expect(iosContentHeight(10)).toBe(0);
  });

  it("orta boy: başlık AÇIKKEN de başlık + en az iki satır sığar (eskiden başlık kırpılıyordu)", () => {
    const fit = fitRows({
      available: ortaBoy,
      header: ortaRahat.header,
      row: iosReminderRowHeight(ortaRahat, true),
      gap: ortaRahat.gap,
      label: 12,
      total: 8,
      limit: 100,
    });
    expect(fit.rows).toBe(2);
    // İçerik gerçekten çerçeveye sığıyor: başlık + 2 satır + aralıklar ≤ alan.
    const kullanilan =
      ortaRahat.header + 2 * iosReminderRowHeight(ortaRahat, true) + ortaRahat.gap;
    expect(kullanilan).toBeLessThanOrEqual(ortaBoy);
  });

  it("hiçbir profil + boyut birleşimi içeriği aileden taşırmaz", () => {
    for (const family of ["medium", "large"]) {
      for (const compact of [false, true]) {
        for (const showTitle of [true, false]) {
          for (const showIcon of [true, false]) {
            const m = iosReminderMetrics({ family, compact });
            const alan = iosContentHeight(IOS_FAMILY_SIZE[family].height);
            const row = iosReminderRowHeight(m, showIcon);
            const header = showTitle ? m.header : 0;
            const { rows, overflow } = fitRows({
              available: alan,
              header,
              row,
              gap: m.gap,
              label: 12,
              total: 50,
              limit: 100,
            });
            const toplam =
              header + rows * row + (rows - 1) * m.gap + (overflow ? m.gap + 12 : 0);
            expect(toplam).toBeLessThanOrEqual(alan);
          }
        }
      }
    }
  });

  it("Listelerim: hiçbir profil içeriği aileden taşırmaz; orta boyda başlık + 3 liste sığar", () => {
    for (const family of ["medium", "large"]) {
      for (const compact of [false, true]) {
        for (const showTitle of [true, false]) {
          const m = iosListMetrics({ family, compact });
          const alan = iosContentHeight(IOS_FAMILY_SIZE[family].height);
          const header = showTitle ? m.header : 0;
          const { rows } = fitRows({
            available: alan,
            header,
            row: m.row,
            gap: m.gap,
            label: 10000,
            total: 50,
            limit: Infinity,
          });
          expect(header + rows * m.row + (rows - 1) * m.gap).toBeLessThanOrEqual(alan);
        }
      }
    }
    const m = iosListMetrics({ family: "medium", compact: false });
    const { rows } = fitRows({
      available: iosContentHeight(IOS_FAMILY_SIZE.medium.height),
      header: m.header,
      row: m.row,
      gap: m.gap,
      label: 10000,
      total: 8,
      limit: Infinity,
    });
    expect(rows).toBe(3);
  });

  it("kullanıcı sınırı ve toplam satır sayısı üst sınırdır, en az 1 satır çizilir", () => {
    const girdi = { available: 400, header: 0, row: 30, gap: 5, label: 12 };
    expect(fitRows({ ...girdi, total: 3, limit: 100 }).rows).toBe(3);
    expect(fitRows({ ...girdi, total: 50, limit: 2 }).rows).toBe(2);
    expect(fitRows({ ...girdi, total: 0, limit: 5 })).toEqual({ rows: 0, overflow: false });
    // Alan tek satıra bile yetmiyorsa yine de 1 satır.
    expect(fitRows({ available: 10, header: 0, row: 30, gap: 5, label: 12, total: 5, limit: 5 }).rows).toBe(1);
  });

  it("'+N daha' etiketi yalnız yer kalırsa konur; satır etikete feda edilmez", () => {
    // 3 satır: 3*30 + 2*5 = 100. Alan 100 → etikete yer yok.
    expect(fitRows({ available: 100, header: 0, row: 30, gap: 5, label: 12, total: 9, limit: 9 })).toEqual({
      rows: 3,
      overflow: false,
    });
    // Alan 120 → 3 satır + etiket (5 + 12 = 17 ≤ 20).
    expect(fitRows({ available: 120, header: 0, row: 30, gap: 5, label: 12, total: 9, limit: 9 })).toEqual({
      rows: 3,
      overflow: true,
    });
    // Her şey sığıyorsa etiket yok.
    expect(fitRows({ available: 120, header: 0, row: 30, gap: 5, label: 12, total: 3, limit: 9 }).overflow).toBe(false);
  });
});

describe("İstatistikler orta boy planı", () => {
  const yukseklik = iosContentHeight(IOS_FAMILY_SIZE.medium.height); // 126
  const hepsi = { height: yukseklik, showTitle: false, showMovies: true, showTv: true, showDuration: true };

  it("iki kart + şerit 6,1\" iPhone'un orta boyuna sığar", () => {
    const plan = iosStatsMediumPlan(hepsi);
    expect(plan.bothCards).toBe(true);
    expect(plan.showStrip).toBe(true);
    expect(IOS_STATS_MEDIUM.bothCards + IOS_STATS_MEDIUM.gap + IOS_STATS_MEDIUM.strip).toBeLessThanOrEqual(yukseklik);
  });

  it("başlık açılınca şerit önce düşer, kartlar kalır", () => {
    const plan = iosStatsMediumPlan({ ...hepsi, showTitle: true });
    expect(plan.bothCards).toBe(true);
    expect(plan.showStrip).toBe(false);
  });

  it("küçük telefonda (orta ≈116 pt) şerit düşer", () => {
    expect(iosStatsMediumPlan({ ...hepsi, height: 116 }).showStrip).toBe(false);
  });

  it("tek kart seçiliyken geniş kart + şerit rahatça sığar, kart yoksa yalnız şerit", () => {
    const tek = iosStatsMediumPlan({ ...hepsi, showTv: false, showTitle: true });
    expect(tek.bothCards).toBe(false);
    expect(tek.anyCard).toBe(true);
    expect(tek.showStrip).toBe(true);
    const yok = iosStatsMediumPlan({ ...hepsi, showMovies: false, showTv: false });
    expect(yok.anyCard).toBe(false);
    expect(yok.showStrip).toBe(true);
  });
});

describe("aileler ve oranlar", () => {
  it("istenen aile yoksa desteklenen sonuncusuna düşer; üç widget da orta + büyük", () => {
    expect(IOS_FAMILIES.stats).toEqual(["medium", "large"]);
    expect(iosFamilyFor("stats", "medium")).toBe("medium");
    expect(iosFamilyFor("reminders", "medium")).toBe("medium");
    expect(iosFamilyFor("lists", "bilinmeyen")).toBe("large");
  });

  it("iOS oranı aile ölçüsünden, Android oranı hücre tablosundan gelir", () => {
    expect(widgetAspect("ios", "reminders", "medium")).toBeCloseTo(
      IOS_FAMILY_SIZE.medium.width / IOS_FAMILY_SIZE.medium.height,
    );
    expect(widgetAspect("android", "stats")).toBe(ANDROID_ASPECT.stats);
    expect(widgetAspect("android", "yok")).toBe(ANDROID_ASPECT.reminders);
  });

  it("iOS widget'ı sahneden geniş çizilmez; Android sahneyi doldurur", () => {
    expect(widgetNaturalWidth("ios", "lists", "large", 500)).toBe(IOS_FAMILY_SIZE.large.width);
    expect(widgetNaturalWidth("ios", "lists", "large", 300)).toBe(300);
    expect(widgetNaturalWidth("android", "lists", "large", 500)).toBe(500);
  });

  it("fitScale: sığıyorsa 1, sığmıyorsa orantılı ama alt sınırlı", () => {
    expect(fitScale(200, 240)).toBe(1);
    expect(fitScale(300, 240)).toBeCloseTo(0.8);
    expect(fitScale(1000, 240)).toBe(0.6);
    expect(fitScale(0, 240)).toBe(1);
  });
});

describe("platform yetenekleri", () => {
  it("iOS'ta Android'e özgü kontroller kapalı", () => {
    const ios = widgetCapabilities("ios");
    expect(ios.reminderLimit).toBe(false);
    expect(ios.listsPosterLimit).toBe(false);
    expect(ios.listsNavigation).toBe(false);
    expect(ios.reminderArtwork).toBe("badge");
    expect(ios.sizePicker).toBe(true);
  });

  it("Android'de hepsi açık, boyut seçici yok", () => {
    const android = widgetCapabilities("android");
    expect(android.reminderLimit).toBe(true);
    expect(android.listsPosterLimit).toBe(true);
    expect(android.listsNavigation).toBe(true);
    expect(android.reminderArtwork).toBe("poster");
    expect(android.sizePicker).toBe(false);
  });
});

describe("örnek veri", () => {
  const simdi = new Date(2026, 9, 14, 15, 30); // 14 Ekim 2026

  it("geri sayım metinleri widget'ın kendi yazdığıyla aynı", () => {
    expect(countdownLabel(0, true)).toBe("Bugün");
    expect(countdownLabel(1, true)).toBe("Yarın");
    expect(countdownLabel(3, true)).toBe("3 gün");
    expect(countdownLabel(0, false)).toBe("Today");
    expect(countdownLabel(1, false)).toBe("Tomorrow");
    expect(countdownLabel(3, false)).toBe("3 days");
  });

  it("tarihler bugünden türer ve ay sınırını aşar", () => {
    const tr = buildReminderSamples({ now: simdi, isTr: true });
    expect(tr[0].daysLeft).toBe(0);
    expect(tr[0].when).toBe("Bugün");
    expect(tr[0].date).toBe("14 Eki");
    // +24 gün → 7 Kasım
    expect(tr[tr.length - 1].date).toBe("7 Kas");
    const en = buildReminderSamples({ now: simdi, isTr: false });
    expect(en[0].when).toBe("Today");
    expect(en[0].date).toBe("14 Oct");
    expect(shortDate(new Date(2026, 0, 5), false)).toBe("5 Jan");
  });

  it("dizi satırlarının alt bilgisi servisle aynı biçimde", () => {
    const tr = buildReminderSamples({ now: simdi, isTr: true });
    expect(tr.find((i) => i.type === "tv").sub).toBe("S3 · 5. Bölüm");
    const en = buildReminderSamples({ now: simdi, isTr: false });
    expect(en.find((i) => i.type === "tv").sub).toBe("S3 · Episode 5");
    expect(en.find((i) => i.type === "movie").sub).toBe("");
  });

  it("liste örnekleri iOS büyük boyun en çok satırını doldurur", () => {
    const listeler = buildListSamples({ isTr: true });
    expect(listeler.length).toBeGreaterThanOrEqual(8);
    expect(new Set(listeler.map((l) => l.id)).size).toBe(listeler.length);
  });
});
