// scripts/ai-eval/lib/report.js
//
// Puanlanmış satırlardan model başına özet + Markdown rapor üretir.

import { MODELS } from "./models.js";

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const usd = (v, digits = 5) => `$${v.toFixed(digits)}`;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

export function summarize(rows) {
  const n = rows.length;
  const ok = rows.filter((r) => r.status === "ok");
  const withTitles = ok.filter((r) => r.titles && r.titles.total > 0);
  const sum = (key) => withTitles.reduce((a, r) => a + (r.titles[key] || 0), 0);
  const totalTitles = sum("total");
  const cost = rows.reduce((a, r) => a + r.costUsd, 0);
  const failCounts = {};
  rows.forEach((r) => (r.fail || []).forEach((f) => (failCounts[f] = (failCounts[f] || 0) + 1)));
  return {
    n,
    errors: rows.filter((r) => r.status === "error").length,
    passed: rows.filter((r) => r.pass).length,
    parsed: ok.filter((r) => r.parsed).length,
    repaired: ok.filter((r) => r.repaired).length,
    truncated: ok.filter((r) => r.truncated).length,
    refused: ok.filter((r) => r.refused).length,
    typeOk: ok.filter((r) => r.typeOk || r.locked).length,
    schemaClean: ok.filter((r) => r.parsed && (r.issues || []).length === 0).length,
    titles: {
      total: totalTitles,
      exact: sum("exact"),
      close: sum("close"),
      wrong_type: sum("wrong_type"),
      loose: sum("loose"),
      none: sum("none"),
      appFound: sum("appFound"),
    },
    violations: ok.reduce((a, r) => a + (r.violations || 0), 0),
    offList: ok.reduce((a, r) => a + (r.offList || 0), 0),
    avgInput: avg(ok.map((r) => r.usage.input)),
    avgOutput: avg(ok.map((r) => r.usage.output + r.usage.thoughts)),
    avgCost: ok.length ? cost / ok.length : 0,
    totalCost: cost,
    p50: quantile(ok.map((r) => r.latencyMs).filter((x) => x != null), 0.5),
    p95: quantile(ok.map((r) => r.latencyMs).filter((x) => x != null), 0.95),
    failCounts,
  };
}

export function renderReport({ scored, cases, generatedAt, runs }) {
  const models = [...new Set(scored.map((r) => r.model))];
  const by = Object.fromEntries(models.map((m) => [m, scored.filter((r) => r.model === m)]));
  const S = Object.fromEntries(models.map((m) => [m, summarize(by[m])]));
  const label = (m) => MODELS[m]?.label || m;
  const baseline = models[0];
  const lines = [];
  const row = (title, f) => lines.push(`| ${title} | ${models.map((m) => f(S[m], m)).join(" | ")} |`);

  lines.push(`# Yapay zeka modeli karşılaştırması`, "");
  lines.push(`Oluşturulma: ${generatedAt} · vaka: ${cases.length} · tekrar: ${runs} · temel model: ${label(baseline)}`, "");
  lines.push(`| Ölçüt | ${models.map(label).join(" | ")} |`);
  lines.push(`|---|${models.map(() => "---:").join("|")}|`);
  row("**Kabul oranı** (tüm ölçütler)", (s) => `**${pct(s.passed, s.n)}**`);
  row("API hatası", (s) => `${s.errors}`);
  row("JSON ayrıştı", (s) => pct(s.parsed, s.n));
  row("Kesik yanıttan onarıldı", (s) => pct(s.repaired, s.n));
  row("max_tokens'ta kesildi", (s) => pct(s.truncated, s.n));
  row("Doğru yanıt tipi", (s) => pct(s.typeOk, s.n));
  row("Şemaya tam uyum", (s) => pct(s.schemaClean, s.n));
  row("Başlık TMDB'de aynı adla var", (s) => pct(s.titles.exact + s.titles.close, s.titles.total));
  row("  yanlış tür (film↔dizi)", (s) => pct(s.titles.wrong_type, s.titles.total));
  row("  şüpheli (uygulama kart gösterir, ad tutmaz)", (s) => pct(s.titles.loose, s.titles.total));
  row("  hiç sonuç yok", (s) => pct(s.titles.none, s.titles.total));
  row("İzlenmiş/önerilmiş başlığı tekrarladı", (s) => `${s.violations}`);
  row("Liste dışı seçim (\"listemden\" isteklerinde)", (s) => `${s.offList}`);
  row("Ort. giriş token'ı", (s) => s.avgInput.toFixed(0));
  row("Ort. çıkış token'ı (düşünme dahil)", (s) => s.avgOutput.toFixed(0));
  row("Ort. maliyet / mesaj", (s) => usd(s.avgCost));
  row("1.000 mesaj", (s) => usd(s.avgCost * 1000, 2));
  row("Bu çalıştırmanın toplam maliyeti", (s) => usd(s.totalCost, 4));
  row("Gecikme p50 / p95", (s) => `${s.p50 ?? "—"} / ${s.p95 ?? "—"} ms`);
  lines.push("");

  // Temel modele göre eşli karşılaştırma
  if (models.length > 1) {
    lines.push(`## ${label(baseline)} ile eşli karşılaştırma`, "");
    lines.push("| Model | Her ikisi geçti | Yalnız bu geçti | Yalnız temel geçti | İkisi de kaldı |", "|---|---:|---:|---:|---:|");
    const key = (r) => `${r.caseId}#${r.run}`;
    const baseMap = new Map(by[baseline].map((r) => [key(r), r.pass]));
    for (const m of models.slice(1)) {
      let both = 0, onlyThis = 0, onlyBase = 0, neither = 0;
      for (const r of by[m]) {
        if (!baseMap.has(key(r))) continue;
        const b = baseMap.get(key(r));
        if (r.pass && b) both++;
        else if (r.pass) onlyThis++;
        else if (b) onlyBase++;
        else neither++;
      }
      lines.push(`| ${label(m)} | ${both} | ${onlyThis} | ${onlyBase} | ${neither} |`);
    }
    lines.push("");
  }

  // Kategori kırılımı
  const cats = [...new Set(scored.map((r) => r.category))].sort();
  lines.push("## Kabul oranı — vaka türüne göre", "");
  lines.push(`| Tür | ${models.map(label).join(" | ")} |`, `|---|${models.map(() => "---:").join("|")}|`);
  for (const c of cats) {
    const cells = models.map((m) => {
      const rs = by[m].filter((r) => r.category === c);
      return `${pct(rs.filter((r) => r.pass).length, rs.length)} (${rs.length})`;
    });
    lines.push(`| ${c} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // En sık kusur nedenleri
  lines.push("## En sık kusur nedenleri", "");
  for (const m of models) {
    const top = Object.entries(S[m].failCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    lines.push(`- **${label(m)}**: ${top.length ? top.map(([k, v]) => `${k} ×${v}`).join(", ") : "kusur yok"}`);
  }
  lines.push("");

  // Şüpheli başlık örnekleri
  lines.push("## Şüpheli başlık örnekleri (ilk 12 / model)", "");
  for (const m of models) {
    const ex = by[m].flatMap((r) => (r.suspect || []).map((s) => `${s} ← ${r.caseId}`)).slice(0, 12);
    lines.push(`**${label(m)}**`, ...(ex.length ? ex.map((e) => `- ${e}`) : ["- yok"]), "");
  }

  lines.push(
    "## Nasıl okunur",
    "",
    "- *Kabul*: JSON temiz ayrıştı, beklenen tip, şema kuralları, başlıkların ≥%80'i TMDB'de aynı adla var, izlenmiş/önerilmiş başlık yok, konu dışı istek reddedildi.",
    "- *Şüpheli*: TMDB araması sonuç verdi ama hiçbiri aynı ad değil. Uygulama bunu poster olarak gösterir; yanlış film görünür.",
    "- Kalite farkı küçükse (örn. 2–3 puan) tek çalıştırmada gürültü olabilir: `AI_EVAL_RUNS=3` ile tekrarla.",
    "- Bu ölçüm *başlığın var olmasını* doğrular; önerinin kullanıcıya uygun olup olmadığını (zevk) ölçmez. Son kararda birkaç yanıtı gözle de oku.",
    "",
  );
  return lines.join("\n");
}
