/**
 * Tarih çarkında yalnız gerçekten seçilebilir satırları bırakır.
 * `sourceIndex`, filtrelenmiş çark indexini asıl gün/ay/yıl indexine çevirir.
 */
export function buildEnabledOptions(items, disabledFlags, preferredIndex = 0) {
  const options = items.reduce((result, label, sourceIndex) => {
    if (!disabledFlags?.[sourceIndex]) result.push({ label, sourceIndex });
    return result;
  }, []);
  if (options.length || !items.length) return options;

  // Ters/bozuk bir min-max aralığı FlatList'i boş bırakmamalı.
  const sourceIndex = Math.max(0, Math.min(items.length - 1, preferredIndex));
  return [{ label: items[sourceIndex], sourceIndex }];
}

