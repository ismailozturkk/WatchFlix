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

  it: {
  overall: "Complessiva",
  overallSubtitle: "Classifica tra tutti i giochi",
  gameSubtitle: title => `${title} classifica`,
  overallMeta: (games, firsts) => `${games} ${games === 1 ? "gioco" : "giochi"}${firsts ? ` · ${firsts} ${firsts === 1 ? "primo posto" : "primi posti"}` : ""}`,
  correctMeta: n => `${n} corretto`,
  partial: "Impossibile caricare alcune schede; la classifica generale potrebbe essere incompleta.",
  overallRules: ["Il tuo posto sul tabellone di ogni gioco fa guadagnare punti: il 1° ottiene " + RANK_POINTS_MAX + ", il 2° ottiene " + (RANK_POINTS_MAX - 1) + "… " + RANK_POINTS_MAX + "esimo ottiene 1.", "Il tuo punteggio complessivo è la somma dei punti di ogni partita.", "I giocatori con punteggi uguali condividono lo stesso posto e gli stessi punti.", "Se i punteggi complessivi sono pari, vincono più primi posti, quindi si classifica in più giochi."],
  overallNote: "I punteggi dei giochi utilizzano scale diverse, quindi non vengono sommati; conta solo il tuo posto in ogni partita. La parte superiore" + RANK_POINTS_MAX + "i giocatori di ogni gioco guadagnano punti.",
  quickNote: "Il tuo record in questo gioco viene pubblicato al termine della partita (dopo la partita successiva se hai giocato offline). In Poster sfocato il punteggio corrisponde al totale dei tuoi punti.",
  posterNote: "Il tabellone Poster Puzzle utilizza i risultati Classico + Normale; i giochi della lista personale non hanno effetto."
},
  fr: {
    overall: "Général",
    overallSubtitle: "Classement sur tous les jeux",
    gameSubtitle: (title) => `Classement ${title}`,
    overallMeta: (games, firsts) => `${games} ${games === 1 ? "game" : "games"}${firsts ? ` · ${firsts} ${firsts === 1 ? "first place" : "first places"}` : ""}`,
    correctMeta: (n) => `${n} correctes`,
    partial: "Certains classements n'ont pas pu être chargés ; le classement général peut être incomplet.",
    overallRules: [
      "Ta place dans le classement de chaque jeu rapporte des points : la 1re place rapporte " + RANK_POINTS_MAX + ", la 2e " + (RANK_POINTS_MAX - 1) + "… " + RANK_POINTS_MAX + "e place rapporte 1.",
      "Ton score général est la somme des points de tous les jeux.",
      "Les joueurs à égalité partagent la même place et les mêmes points.",
      "En cas d'égalité au score général, le plus de premières places l'emporte, puis le classement dans le plus de jeux.",
    ],
    overallNote: "Les scores des jeux utilisent des échelles différentes, ils ne s'additionnent donc pas ; seule ta place dans chaque jeu compte. Les " + RANK_POINTS_MAX + " premiers joueurs de chaque jeu gagnent des points.",
    quickNote: "Ton record dans ce jeu est publié à la fin d'une partie (après ta prochaine partie si tu as joué hors ligne). Dans Affiche floue, le score est ton total de points.",
    posterNote: "Le classement du Puzzle d'affiche utilise les résultats Classique + Normal ; les parties sur des listes personnelles ne comptent pas.",
  },
  ja: {
    overall: "総合",
    overallSubtitle: "全ゲームのランキング",
    gameSubtitle: (title) => `${title}のランキング`,
    overallMeta: (games, firsts) => `${games} ${games === 1 ? "game" : "games"}${firsts ? ` · ${firsts} ${firsts === 1 ? "first place" : "first places"}` : ""}`,
    correctMeta: (n) => `${n}問正解`,
    partial: "一部のランキングを読み込めなかったため、総合ランキングが不完全な可能性があります。",
    overallRules: [
      "各ゲームのランキングでの順位に応じてポイントを獲得:1位は" + RANK_POINTS_MAX + "、2位は" + (RANK_POINTS_MAX - 1) + "… " + RANK_POINTS_MAX + "位は1。",
      "総合スコアは全ゲームのポイントの合計です。",
      "同点のプレイヤーは同じ順位とポイントになります。",
      "総合スコアが同点の場合は、1位の数が多い方、次にランクインしたゲーム数が多い方が上位です。",
    ],
    overallNote: "ゲームごとにスコアの尺度が違うため合算はせず、各ゲームでの順位だけを数えます。各ゲームの上位" + RANK_POINTS_MAX + "人のプレイヤーがポイントを獲得します。",
    quickNote: "このゲームでの記録はゲーム終了時に投稿されます(オフラインでプレイした場合は次のゲーム後)。ぼやけたポスターでは合計ポイントがスコアになります。",
    posterNote: "ポスターパズルのランキングはクラシック+ノーマルの結果を使います。個人リストのゲームは影響しません。",
  }};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getGameBoardsCopy = (language) => GAME_BOARDS_COPY[copyLanguage(language, Object.keys(GAME_BOARDS_COPY))];
