// utils/dailyLimitCopy.js
//
// Günlük 1440 dakika izleme sınırının metinleri (5 dil). Mantık
// utils/dailyWatchLimit.js'te; hata mesajı utils/libraryErrorText.js, yayılma
// bildirimi `watchSpreadNotice` üzerinden gösterilir. Beş dilin eşitliğini
// __tests__/copyTablesSpanish.test.js korur.

import { copyLanguage } from "./appLanguages";

const tr = {
  // {day} biçimli tarih, {remaining}/{requested}: "3 sa 20 dk"
  full: "{day} günü için süre doldu: günde en fazla 24 saat izlenebilir. Kalan {remaining}, eklemek istediğin {requested}. Başka bir gün seç.",
  fullNone: "{day} günü için 24 saatlik süre doldu. Başka bir gün seç.",
  span: "Bu içerik ({requested}) seçtiğin günden geriye doğru {days} güne bile sığmıyor. Daha geç bir tarih seç ya da bölümleri ayrı ayrı işaretle.",
  spreadTitle: "Günlük sınır nedeniyle yayıldı",
  spreadBody: "Bir güne en fazla 24 saat sığar; bölümler {start} – {end} arasına {days} güne dağıtıldı.",
  hour: "sa",
  minute: "dk",
};

const en = {
  full: "{day} is full: at most 24 hours can be logged per day. {remaining} left, you tried to add {requested}. Pick another day.",
  fullNone: "The 24 hours for {day} are used up. Pick another day.",
  span: "This title ({requested}) does not fit even in {days} days back from the date you picked. Pick a later date or mark episodes one by one.",
  spreadTitle: "Spread over several days",
  spreadBody: "A day holds at most 24 hours, so the episodes were spread over {days} days, {start} – {end}.",
  hour: "h",
  minute: "min",
};

const es = {
  full: "El {day} está lleno: solo se pueden registrar 24 horas al día. Quedan {remaining} y quieres añadir {requested}. Elige otro día.",
  fullNone: "Las 24 horas del {day} ya están usadas. Elige otro día.",
  span: "Este título ({requested}) no cabe ni en {days} días hacia atrás desde la fecha elegida. Elige una fecha posterior o marca los episodios uno por uno.",
  spreadTitle: "Repartido en varios días",
  spreadBody: "Un día admite como máximo 24 horas, así que los episodios se repartieron en {days} días, del {start} al {end}.",
  hour: "h",
  minute: "min",
};

const pt = {
  full: "O dia {day} está cheio: só dá para registrar 24 horas por dia. Restam {remaining} e você quer adicionar {requested}. Escolha outro dia.",
  fullNone: "As 24 horas do dia {day} já foram usadas. Escolha outro dia.",
  span: "Este título ({requested}) não cabe nem em {days} dias para trás a partir da data escolhida. Escolha uma data mais recente ou marque os episódios um a um.",
  spreadTitle: "Distribuído em vários dias",
  spreadBody: "Um dia comporta no máximo 24 horas, então os episódios foram distribuídos em {days} dias, de {start} a {end}.",
  hour: "h",
  minute: "min",
};

const de = {
  full: "Der {day} ist voll: pro Tag lassen sich höchstens 24 Stunden eintragen. Noch frei: {remaining}, du wolltest {requested} hinzufügen. Wähle einen anderen Tag.",
  fullNone: "Die 24 Stunden für den {day} sind aufgebraucht. Wähle einen anderen Tag.",
  span: "Dieser Titel ({requested}) passt nicht einmal in {days} Tage rückwärts ab dem gewählten Datum. Wähle ein späteres Datum oder markiere die Folgen einzeln.",
  spreadTitle: "Auf mehrere Tage verteilt",
  spreadBody: "Ein Tag fasst höchstens 24 Stunden, deshalb wurden die Folgen auf {days} Tage verteilt, {start} – {end}.",
  hour: "Std.",
  minute: "Min.",
};

export const DAILY_LIMIT_COPY = Object.freeze({ tr, en, es, pt, de });

export const getDailyLimitCopy = (language) =>
  DAILY_LIMIT_COPY[copyLanguage(language, Object.keys(DAILY_LIMIT_COPY))];

/** 200 → "3 sa 20 dk"; 0 → "0 dk". */
export function formatMinutes(total, copy) {
  const value = Math.max(0, Math.round(Number(total) || 0));
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes} ${copy.minute}`;
  if (!minutes) return `${hours} ${copy.hour}`;
  return `${hours} ${copy.hour} ${minutes} ${copy.minute}`;
}

const fill = (text, values) =>
  Object.entries(values).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value)), text);

/** "2026-10-22" → yerel dilde okunur gün ("22 Eki 2026"). */
export function formatDay(day, language) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ""));
  if (!match) return String(day ?? "");
  try {
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)));
  } catch {
    return match[0];
  }
}

/** DAILY_LIMIT hatasının kullanıcı metni (`error.details` = planDailyWatch hata gövdesi). */
export function dailyLimitMessage(details, language) {
  const copy = getDailyLimitCopy(language);
  const d = details || {};
  if (d.reason === "span") {
    return fill(copy.span, {
      requested: formatMinutes(d.requested, copy),
      days: d.days ?? "",
    });
  }
  if (!d.remaining) return fill(copy.fullNone, { day: formatDay(d.day, language) });
  return fill(copy.full, {
    day: formatDay(d.day, language),
    remaining: formatMinutes(d.remaining, copy),
    requested: formatMinutes(d.requested, copy),
  });
}

/** Toplu eklemenin günlere yayıldığını anlatan bildirim: { title, body } ya da null. */
export function dailySpreadNotice(spread, language) {
  if (!spread || !spread.days || spread.days < 2) return null;
  const copy = getDailyLimitCopy(language);
  return {
    title: copy.spreadTitle,
    body: fill(copy.spreadBody, {
      days: spread.days,
      start: formatDay(spread.startDate, language),
      end: formatDay(spread.endDate, language),
    }),
  };
}
