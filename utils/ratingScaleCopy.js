// utils/ratingScaleCopy.js — Ayarlar > Kişiselleştirme "Puanlama sistemi" kartı (8 uygulama dili).
import { copyLanguage } from "./appLanguages";

const tr = {
  title: "Puanlama sistemi",
  subtitle: "Film ve dizilere kaç yıldızla puan verdiğin",
  ten: "10 yıldız",
  tenSub: "Küsuratlı · 8,5 / 10",
  five: "5 yıldız",
  fiveSub: "Küsuratsız · 9 / 10",
  hint: "Puanlar her iki sistemde de 10 üzerinden. 5 yıldızda her yarım yıldız 1 puan, küsurat yok; 10 yıldızda verdiğin 8,5 burada 9 görünür.",
};

const en = {
  title: "Rating system",
  subtitle: "How many stars you rate movies and shows with",
  ten: "10 stars",
  tenSub: "With halves · 8.5 / 10",
  five: "5 stars",
  fiveSub: "Whole points · 9 / 10",
  hint: "Ratings are out of 10 in both systems. With 5 stars each half star is 1 point, no halves; an 8.5 given with 10 stars shows as 9 here.",
};

const es = {
  title: "Sistema de puntuación",
  subtitle: "Con cuántas estrellas puntúas películas y series",
  ten: "10 estrellas",
  tenSub: "Con decimales · 8,5 / 10",
  five: "5 estrellas",
  fiveSub: "Sin decimales · 9 / 10",
  hint: "En ambos sistemas puntúas sobre 10. Con 5 estrellas cada media estrella vale 1 punto, sin decimales; un 8,5 dado con 10 estrellas aquí se ve como 9.",
};

const pt = {
  title: "Sistema de notas",
  subtitle: "Com quantas estrelas você avalia filmes e séries",
  ten: "10 estrelas",
  tenSub: "Com decimais · 8,5 / 10",
  five: "5 estrelas",
  fiveSub: "Sem decimais · 9 / 10",
  hint: "Nos dois sistemas a nota é de 0 a 10. Com 5 estrelas cada meia estrela vale 1 ponto, sem decimais; um 8,5 dado com 10 estrelas aparece aqui como 9.",
};

const de = {
  title: "Bewertungssystem",
  subtitle: "Mit wie vielen Sternen du Filme und Serien bewertest",
  ten: "10 Sterne",
  tenSub: "Mit Kommastelle · 8,5 / 10",
  five: "5 Sterne",
  fiveSub: "Ganze Punkte · 9 / 10",
  hint: "In beiden Systemen wird von 10 bewertet. Bei 5 Sternen ist jeder halbe Stern 1 Punkt, ohne Kommastelle; eine mit 10 Sternen vergebene 8,5 erscheint hier als 9.",
};

const it = {
  title: "Sistema di valutazione",
  subtitle: "Con quante stelle valuti film e serie",
  ten: "10 stelle",
  tenSub: "Con decimali · 8,5 / 10",
  five: "5 stelle",
  fiveSub: "Senza decimali · 9 / 10",
  hint: "In entrambi i sistemi il voto è su 10. Con 5 stelle ogni mezza stella vale 1 punto, senza decimali; un 8,5 dato con 10 stelle qui appare come 9.",
};

const fr = {
  title: "Système de notation",
  subtitle: "Le nombre d'étoiles pour noter films et séries",
  ten: "10 étoiles",
  tenSub: "Avec décimales · 8,5 / 10",
  five: "5 étoiles",
  fiveSub: "Sans décimales · 9 / 10",
  hint: "Dans les deux systèmes, la note est sur 10. Avec 5 étoiles, chaque demi-étoile vaut 1 point, sans décimales ; un 8,5 donné avec 10 étoiles s'affiche ici en 9.",
};

const ja = {
  title: "評価システム",
  subtitle: "映画やドラマを何個の星で評価するか",
  ten: "星10個",
  tenSub: "小数あり · 8.5 / 10",
  five: "星5個",
  fiveSub: "整数のみ · 9 / 10",
  hint: "どちらも10点満点です。星5個では星半分が1点で、小数はありません。星10個で付けた8.5はここでは9と表示されます。",
};

export const RATING_SCALE_COPY = Object.freeze({ tr, en, es, pt, de, it, fr, ja });

/** Uygulama diline göre metin (bilinmeyen dil → İngilizce). */
export const getRatingScaleCopy = (language) =>
  RATING_SCALE_COPY[copyLanguage(language, Object.keys(RATING_SCALE_COPY))];
