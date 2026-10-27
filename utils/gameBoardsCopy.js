// utils/gameBoardsCopy.js
//
// Liderlik ekranının oyun seçicisi ve "Genel" sıralama metinleri (tr / en / es / pt / de). Oyun adları kendi
// tablolarından gelir (Sahne Tahmin / Poster Bulmaca: gameRegistry, "Önce hangisi?": olderGameCopy, hızlı oyunlar:
// quickGamesCopy) — burada tekrar yazılmaz. Saf veri; bkz. utils/quickGamesCopy.js.

import { copyLanguage } from "./appLanguages";
import { RANK_POINTS_MAX } from "./gameBoards";

export const GAME_BOARDS_COPY = {
  tr: {
    overall: "Genel",
    overallSubtitle: "Tüm oyunların sıralaması",
    gameSubtitle: (title) => `${title} sıralaması`,
    overallMeta: (games, firsts) => `${games} oyunda${firsts ? ` · ${firsts} birincilik` : ""}`,
    correctMeta: (n) => `${n} doğru`,
    partial: "Bazı oyunların tablosu yüklenemedi; Genel sıralama eksik olabilir.",
    overallRules: [
      "Her oyunun tablosunda yerin puan getirir: 1. olan " + RANK_POINTS_MAX + ", 2. olan " + (RANK_POINTS_MAX - 1) + " puan… " + RANK_POINTS_MAX + ". olan 1 puan alır.",
      "Genel puan, bütün oyunlardan aldığın puanların toplamıdır.",
      "Eşit skorlu oyuncular aynı sırayı ve puanı paylaşır.",
      "Genel puan eşitse daha çok birincilik, sonra daha çok oyunda sıralamaya girmek öne geçer.",
    ],
    overallNote: "Oyunların skorları farklı ölçekte olduğu için toplanmaz; yalnızca her oyundaki sıralaman sayılır. Her oyunun ilk " + RANK_POINTS_MAX + " oyuncusu puan alır.",
    quickNote: "Bu oyundaki rekorun oyun bitince tabloya yazılır (çevrimdışı oynadıysan sonraki oyununda). Bulanık Afiş'te skor, toplanan puandır.",
    posterNote: "Poster Bulmaca tablosu Klasik + Normal sonuçlarından beslenir; kişisel liste oyunları tabloyu etkilemez.",
  },
  en: {
    overall: "Overall",
    overallSubtitle: "Ranking across all games",
    gameSubtitle: (title) => `${title} ranking`,
    overallMeta: (games, firsts) => `${games} ${games === 1 ? "game" : "games"}${firsts ? ` · ${firsts} ${firsts === 1 ? "first place" : "first places"}` : ""}`,
    correctMeta: (n) => `${n} correct`,
    partial: "Some boards couldn't load; the overall ranking may be incomplete.",
    overallRules: [
      "Your place on each game's board earns points: 1st gets " + RANK_POINTS_MAX + ", 2nd gets " + (RANK_POINTS_MAX - 1) + "… " + RANK_POINTS_MAX + "th gets 1.",
      "Your overall score is the sum of the points from every game.",
      "Players with equal scores share the same place and points.",
      "If overall scores tie, more first places win, then ranking in more games.",
    ],
    overallNote: "Game scores use different scales, so they aren't added up; only your place in each game counts. The top " + RANK_POINTS_MAX + " players of each game earn points.",
    quickNote: "Your record in this game is posted when a game ends (after your next game if you played offline). In Blurry Poster the score is your points total.",
    posterNote: "The Poster Puzzle board uses Classic + Normal results; personal-list games don't affect it.",
  },
  es: {
    overall: "General",
    overallSubtitle: "Clasificación de todos los juegos",
    gameSubtitle: (title) => `Clasificación de ${title}`,
    overallMeta: (games, firsts) => `${games} ${games === 1 ? "juego" : "juegos"}${firsts ? ` · ${firsts} ${firsts === 1 ? "primer puesto" : "primeros puestos"}` : ""}`,
    correctMeta: (n) => (n === 1 ? "1 acierto" : `${n} aciertos`),
    partial: "Algunas clasificaciones no se cargaron; la general puede estar incompleta.",
    overallRules: [
      "Tu puesto en cada juego da puntos: el 1.º obtiene " + RANK_POINTS_MAX + ", el 2.º " + (RANK_POINTS_MAX - 1) + "… el " + RANK_POINTS_MAX + ".º obtiene 1.",
      "Tu puntuación general es la suma de los puntos de todos los juegos.",
      "Los jugadores empatados comparten puesto y puntos.",
      "Si hay empate en la general, ganan más primeros puestos y luego estar clasificado en más juegos.",
    ],
    overallNote: "Las puntuaciones de los juegos usan escalas distintas, así que no se suman; solo cuenta tu puesto en cada juego. Puntúan los " + RANK_POINTS_MAX + " mejores de cada juego.",
    quickNote: "Tu récord en este juego se publica al terminar una partida (en la siguiente si jugaste sin conexión). En Cartel borroso la puntuación es tu total de puntos.",
    posterNote: "La clasificación de Puzle de póster usa los resultados de Clásico + Normal; las partidas con listas personales no la afectan.",
  },
  pt: {
    overall: "Geral",
    overallSubtitle: "Ranking de todos os jogos",
    gameSubtitle: (title) => `Ranking de ${title}`,
    overallMeta: (games, firsts) => `${games} ${games === 1 ? "jogo" : "jogos"}${firsts ? ` · ${firsts} ${firsts === 1 ? "primeiro lugar" : "primeiros lugares"}` : ""}`,
    correctMeta: (n) => (n === 1 ? "1 acerto" : `${n} acertos`),
    partial: "Alguns rankings não carregaram; o geral pode estar incompleto.",
    overallRules: [
      "Sua posição em cada jogo vale pontos: o 1º ganha " + RANK_POINTS_MAX + ", o 2º " + (RANK_POINTS_MAX - 1) + "… o " + RANK_POINTS_MAX + "º ganha 1.",
      "Sua pontuação geral é a soma dos pontos de todos os jogos.",
      "Jogadores empatados dividem a posição e os pontos.",
      "Se houver empate no geral, vencem mais primeiros lugares e depois estar no ranking de mais jogos.",
    ],
    overallNote: "As pontuações dos jogos usam escalas diferentes, então não são somadas; só conta sua posição em cada jogo. Os " + RANK_POINTS_MAX + " melhores de cada jogo pontuam.",
    quickNote: "Seu recorde neste jogo é publicado ao fim de uma partida (na próxima, se jogou offline). No Pôster borrado a pontuação é o seu total de pontos.",
    posterNote: "O ranking do Quebra-cabeça de pôster usa resultados do Clássico + Normal; partidas com listas pessoais não o afetam.",
  },
  de: {
    overall: "Gesamt",
    overallSubtitle: "Rangliste über alle Spiele",
    gameSubtitle: (title) => `Rangliste: ${title}`,
    overallMeta: (games, firsts) => `${games} ${games === 1 ? "Spiel" : "Spiele"}${firsts ? ` · ${firsts}× Platz 1` : ""}`,
    correctMeta: (n) => `${n} richtig`,
    partial: "Einige Ranglisten konnten nicht geladen werden; die Gesamtwertung ist evtl. unvollständig.",
    overallRules: [
      "Dein Platz in jedem Spiel bringt Punkte: Platz 1 bekommt " + RANK_POINTS_MAX + ", Platz 2 " + (RANK_POINTS_MAX - 1) + " … Platz " + RANK_POINTS_MAX + " bekommt 1.",
      "Deine Gesamtpunktzahl ist die Summe der Punkte aus allen Spielen.",
      "Punktgleiche Spieler teilen sich Platz und Punkte.",
      "Bei Gleichstand gewinnen mehr erste Plätze, danach Platzierungen in mehr Spielen.",
    ],
    overallNote: "Die Spiele zählen Punkte unterschiedlich, deshalb wird nicht addiert; nur dein Platz in jedem Spiel zählt. Die besten " + RANK_POINTS_MAX + " jedes Spiels bekommen Punkte.",
    quickNote: "Dein Rekord in diesem Spiel wird nach Spielende eingetragen (beim nächsten Spiel, falls du offline gespielt hast). Beim Unscharfen Poster ist die Punktzahl deine Punktesumme.",
    posterNote: "Die Poster-Puzzle-Rangliste nutzt Ergebnisse aus Klassik + Normal; Spiele mit eigenen Listen zählen nicht.",
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getGameBoardsCopy = (language) => GAME_BOARDS_COPY[copyLanguage(language, Object.keys(GAME_BOARDS_COPY))];
