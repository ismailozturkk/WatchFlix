// services/postDraftService.js
//
// Gönderi taslaklarının TEK erişim noktası.
//
// GEÇİŞ ÖNCESİ SORUN: `"post_drafts"` anahtarı ÜÇ ayrı dosyada elle yazılıydı
// (CreatePostModal, MyActivityScreen, MyActivityButton). Üçü de kendi
// JSON.parse'ını, kendi hata yutmasını ve kendi "dizi mi?" kontrolünü
// tekrarlıyordu — StoryDraftService varken gönderi taslaklarının servisi yoktu.
//
// GİZLİLİK: kayıt ayrıca uid'siz globaldi; aynı cihazda hesap değiştiren
// kullanıcı öncekinin GÖNDERİLMEMİŞ taslaklarını görüyordu. Artık kullanıcı
// kapsamlı — aktif uid'i depolama katmanı çözüyor.

import { Keys, get, set } from "./storage";

/** Taslaklar (yeni → eski). Kayıt yoksa/bozuksa boş dizi. */
export function getPostDrafts() {
  const list = get(Keys.postDrafts);
  return Array.isArray(list) ? list : [];
}

/** Listeyi olduğu gibi yazar. Başarıysa `true`. */
export function setPostDrafts(list) {
  return set(Keys.postDrafts, Array.isArray(list) ? list : []);
}

export function countPostDrafts() {
  return getPostDrafts().length;
}
