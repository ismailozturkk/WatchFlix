import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.join(__dirname, "..", "screens", "premium", "PremiumScreen.js"),
  "utf8",
);

describe("PremiumScreen purchase hierarchy", () => {
  test("keeps the purchase decision in one clear sequence", () => {
    const plan = source.indexOf("Plan seç");
    const packages = source.indexOf("DIRECT PRICING PACKAGES");
    const cta = source.indexOf("PRIMARY CTA BUTTON");
    const benefits = source.indexOf("Seçili planın öne çıkanları");

    expect(plan).toBeGreaterThan(-1);
    expect(packages).toBeGreaterThan(plan);
    expect(cta).toBeGreaterThan(packages);
    expect(benefits).toBeGreaterThan(cta);
  });

  test("removes decorative repetition from the purchase path", () => {
    expect(source).not.toContain("Live Identity Badge Preview");
    expect(source).not.toContain("Quick Metrics Bar");
    expect(source).not.toContain("ctaShimmer");
    expect(source).not.toContain("valueProps2x2Grid");
  });

  test("retains store purchase, restore, management and comparison behavior", () => {
    expect(source).toContain("purchasePackage(aPackage, { referralHandle })");
    expect(source).toContain("restorePurchases()");
    expect(source).toContain("openCustomerCenter()");
    expect(source).toContain("getComparisonSections(localized)");
    expect(source).toContain("offerDisclosure(selectedOffer, selectedDisplayPackage, language)");
  });

  test("lists every unlocked registry feature in a two-column grid", () => {
    expect(source).toContain("const selectedBenefits = useMemo");
    expect(source).toContain(".filter((row) => !isLockedFor(row.id, selectedTier))");
    expect(source).toContain("selectedBenefits.slice(0, 6)");
    expect(source).toContain("visibleBenefits.map((benefit)");
    expect(source).toContain("accessibilityState={{ expanded: showAllBenefits }}");
    expect(source).toContain("style={styles.benefitGrid}");
    expect(source).toMatch(/benefitCard:\s*\{[\s\S]*?width:\s*"48\.5%"/);
    expect(source).toContain("value: row.values[selectedTier]");
  });
});
