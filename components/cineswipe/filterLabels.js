// components/cineswipe/filterLabels.js
//
// Filtrelerin kullanıcıya gösterilen adları (kaynak, içerik türü, tür) ve
// özet çipleri. Başlık çipleri ile filtre sayfasının alt özeti aynı kaynaktan çıkar.
import { categoryOf, normalizeFilters } from "../../services/cineswipe/deckModel";

export const typeIcon = (type) => (type === "tv" ? "tv-outline" : type === "all" ? "shuffle-outline" : "film-outline");

export function typeLabel(type, copy) {
  if (type === "tv") return copy.filters.shows;
  if (type === "all") return copy.filters.mixed;
  return copy.filters.movies;
}

export const categoryLabel = (id, copy) => copy.categories?.[id] || categoryOf(id).label;

export function genreLabel(genreId, copy) {
  if (genreId == null) return copy.filters.allGenres;
  return copy.genreNames?.[genreId] || "";
}

/**
 * Etkin filtrelerin çip listesi. Tek türlü kaynakta (ör. Popüler Diziler)
 * içerik türü çipi gizlenir: kaynağın adı zaten söylüyor.
 * @returns {Array<{ key: "source"|"type"|"genre", icon: string, label: string }>}
 */
export function describeFilters(filters, copy) {
  const normalized = normalizeFilters(filters);
  const category = categoryOf(normalized.category);
  const parts = [{ key: "source", icon: category.icon, label: categoryLabel(category.id, copy) }];
  if (!category.mediaType) {
    parts.push({ key: "type", icon: typeIcon(normalized.mediaType), label: typeLabel(normalized.mediaType, copy) });
  }
  if (normalized.genreId != null) {
    parts.push({ key: "genre", icon: "pricetag-outline", label: genreLabel(normalized.genreId, copy) });
  }
  return parts;
}
