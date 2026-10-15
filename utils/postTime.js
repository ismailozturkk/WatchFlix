// utils/postTime.js
//
// Paylaşım kartlarındaki göreli zaman metni — SAF (React/i18n importu yok).
// Etiketler çağıran taraftan gelir (`t.shareScreen.timeAgo`), böylece Hub
// akışı ve Postlarım aynı, YEREL dilde metni üretir. Postlarım eskiden bunu
// kendi içinde sabit "dk / sa / g / hf" ile yapıyordu ve İngilizce kullanıcıya
// Türkçe birim basıyordu.

/**
 * @param {number} timestamp  epoch ms (yoksa/0 → "")
 * @param {{now:string, minute:string, hour:string, day:string, week:string}} ago
 * @param {number} [nowMs]    test için sabit "şimdi"
 */
export function formatTimeAgo(timestamp, ago, nowMs = Date.now()) {
  if (!timestamp || !ago) return "";
  const sec = Math.floor((nowMs - timestamp) / 1000);
  if (sec < 60) return ago.now;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${ago.minute}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${ago.hour}`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} ${ago.day}`;
  const w = Math.floor(d / 7);
  return `${w} ${ago.week}`;
}
