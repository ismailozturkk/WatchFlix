// components/feed/postTypeMeta.js
//
// Paylaşım akışındaki tip dili (ikon + renk + etiket) TEK yerde. Composer
// kartındaki hızlı tip kutuları, post kartı rozeti ve filtre çubuğu aynı
// görsel kimliği paylaşsın diye buradan okur; renk/etiket kaynağı zaten
// postTypeBadge (Postlarım ve composer ile ortak) — burada yalnız ikon eklenir.

import { postTypeBadge } from "../../utils/postComposer";
import { i18nText } from "../../utils/i18nText";

export const POST_TYPE_ICONS = {
  review: "star",
  list: "list",
  text: "chatbubble-ellipses",
  poll: "stats-chart",
};

/**
 * @param {string} type        review | list | text | poll (bilinmeyen → review)
 * @param {Object} themeColors theme.colors
 * @returns {{ icon: string, color: string, label: string }}
 */
export function postTypeMeta(type, themeColors) {
  const badge = postTypeBadge(type, themeColors);
  return {
    icon: POST_TYPE_ICONS[type] || POST_TYPE_ICONS.review,
    color: badge.color,
    label: i18nText(badge.labelKey, badge.fallback),
  };
}
