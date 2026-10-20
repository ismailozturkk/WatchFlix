import { buildEnabledOptions } from "../utils/datePickerWheel";

describe("date picker wheel boundaries", () => {
  test("seçilemeyen ayı fiziksel kaydırma verisinden çıkarır", () => {
    const months = ["Ağustos", "Eylül", "Ekim"];
    expect(buildEnabledOptions(months, [false, true, false])).toEqual([
      { label: "Ağustos", sourceIndex: 0 },
      { label: "Ekim", sourceIndex: 2 },
    ]);
  });

  test("sınır dışındaki baş ve son günlere momentumla ulaşılamaz", () => {
    const days = ["01", "02", "03", "04", "05"];
    expect(buildEnabledOptions(days, [true, true, false, false, true])).toEqual([
      { label: "03", sourceIndex: 2 },
      { label: "04", sourceIndex: 3 },
    ]);
  });

  test("bozuk aralıkta listeyi boş bırakmaz", () => {
    expect(buildEnabledOptions(["2025", "2026"], [true, true], 1)).toEqual([
      { label: "2026", sourceIndex: 1 },
    ]);
  });
});

