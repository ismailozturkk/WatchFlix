"""seelogd sosyal medya görsellerini üretir (HTML → PNG, Chrome headless).

Kullanım:
  python uret.py                 # tüm diller, tüm görseller
  python uret.py en              # yalnız İngilizce
  python uret.py tr post-03      # Türkçe, adı "post-03" ile başlayanlar

Metinler: kaynak/metinler/<dil>.json — yeni dil = yeni json + aşağıdaki SLUGS'a ad.
Ekranlar: kaynak/img/ekranlar/<dil>/<ad>.jpg; o dilde yoksa tr/ kullanılır.
Ara HTML'ler kaynak/_html/<dil>/ altına yazılır (elle düzenlenmez, her seferinde yeniden üretilir).
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "kaynak"
OUT = ROOT / "cikti"
CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
R = "../../"  # _html/<dil>/ → kaynak/

LANGS = ["tr", "en"]

# Çıktı dosyası adları: (klasör, ad) — dile göre.
SLUGS = {
    "banner": {"tr": ("banner", "banner-x"), "en": ("banner", "banner-x")},
    "post-01": {"tr": ("post", "post-01-tanitim"), "en": ("post", "post-01-intro")},
    "post-02": {"tr": ("post", "post-02-kesfet"), "en": ("post", "post-02-discover")},
    "post-03": {"tr": ("post", "post-03-cinematch"), "en": ("post", "post-03-cinematch")},
    "post-04": {"tr": ("post", "post-04-oyunlar"), "en": ("post", "post-04-games")},
    "post-05": {"tr": ("post", "post-05-sosyal"), "en": ("post", "post-05-social")},
    "post-06": {"tr": ("post", "post-06-kutuphane"), "en": ("post", "post-06-library")},
    "post-07": {"tr": ("post", "post-07-istatistik"), "en": ("post", "post-07-stats")},
    "post-08": {"tr": ("post", "post-08-premium"), "en": ("post", "post-08-premium")},
    "post-09": {"en": ("post", "post-09-top100")},
    "post-10": {"en": ("post", "post-10-badges")},
    "post-11": {"en": ("post", "post-11-history")},
    "hikaye-01": {"tr": ("hikaye", "hikaye-01-tanitim"), "en": ("story", "story-01-intro")},
}
# Bir dilde bulunmayan ekranın yerine o dilde kullanılacak ekran.
SCREEN_ALIAS = {"en": {"oscar-seri": "yaklasan"}}
SIZES = {"banner": (1500, 500), "hikaye-01": (1080, 1920)}  # gerisi 1080×1350

GLOWS = {
    "blue": '<div class="glow blue" style="width:720px;height:720px;left:180px;top:560px"></div>',
    "violet": '<div class="glow violet" style="width:540px;height:540px;right:-220px;top:-170px"></div>',
    "teal": '<div class="glow teal" style="width:480px;height:480px;left:-240px;top:160px"></div>',
    "pink": '<div class="glow pink" style="width:520px;height:520px;right:-200px;top:520px"></div>',
    "amber": '<div class="glow amber" style="width:560px;height:560px;left:-200px;top:700px"></div>',
}
GRADS = {
    "tb": "linear-gradient(135deg,#2ee6d6,#138df0)",
    "bv": "linear-gradient(135deg,#138df0,#8b7cf6)",
    "vp": "linear-gradient(135deg,#8b7cf6,#ff6fae)",
    "ao": "linear-gradient(135deg,#ffc247,#ff8a3d)",
    "gr": "linear-gradient(135deg,#3ddc97,#2ee6d6)",
    "rd": "linear-gradient(135deg,#ff5f7a,#c2185b)",
}


class Ctx:
    def __init__(self, lang):
        self.lang = lang
        self.t = json.loads((SRC / "metinler" / f"{lang}.json").read_text(encoding="utf-8"))

    def ss(self, name):
        name = SCREEN_ALIAS.get(self.lang, {}).get(name, name)
        own = SRC / "img" / "ekranlar" / self.lang / f"{name}.jpg"
        return f"{R}img/ekranlar/{self.lang if own.exists() else 'tr'}/{name}.jpg"


# ── yapı taşları ─────────────────────────────────────────────────────
def poster(id_):
    return f'<div class="poster"><img src="{R}img/afisler/{id_}.jpg"></div>'


def dev(c, img, w, style, dim=False, z=3):
    cls = "dev side" if dim else "dev"
    return f'<div class="{cls}" style="--w:{w}px; z-index:{z}; {style}"><div class="scr"><img src="{c.ss(img)}"></div></div>'


def callout(icon, grad, pair, style):
    """pair = [başlık, alt yazı] ya da [başlık, alt yazı, simge] (json'dan simge değiştirilebilir)."""
    title, sub = pair[0], pair[1]
    icon = pair[2] if len(pair) > 2 else icon
    return (f'<div class="callout glass" style="{style}"><div class="ic" style="background:{GRADS[grad]}">{icon}</div>'
            f'<div><b>{title}</b><small>{sub}</small></div></div>')


def shot(c, img, src_w, w, crop_top, crop_h, style):
    """Ekran görüntüsünün crop_top..crop_top+crop_h (kaynak px) aralığını w genişliğinde yüzen kart yapar."""
    k = w / src_w
    return (f'<div class="shot" style="width:{w}px; height:{round(crop_h * k)}px; {style}">'
            f'<img src="{c.ss(img)}" style="margin-top:-{round(crop_top * k)}px"></div>')


def dots(items):
    return ' <span class="dot"></span> '.join(items)


def brand():
    return f'<div class="brand"><img src="{R}img/logo/s-mark-tight.png"><span>seelogd</span></div>'


def doc(c, title, css, body):
    return f"""<!doctype html>
<html lang="{c.lang}"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="{R}base.css">
<style>.dev.side {{ filter: brightness(.62) saturate(.9); }}
{css}</style></head>
<body>
{body}
</body></html>
"""


def post(c, title, eyebrow, h1a, h1b, sub, glows, body, foot_left, center=False, css="", eyebrow_cls="", h1b_cls="grad"):
    return doc(c, title, css, f"""<div class="canvas post grain">
  {''.join(GLOWS[g] for g in glows)}
  <div class="top">{brand()}<div class="eyebrow {eyebrow_cls}"><i></i>{eyebrow}</div></div>
  <div class="head{' c' if center else ''}">
    <h1>{h1a}<br><span class="{h1b_cls}">{h1b}</span></h1>
    <p class="sub">{sub}</p>
  </div>
  {body}
  <div class="bottomfade"></div>
  <div class="foot"><div class="stores">{foot_left}</div><div class="stores">{c.t['link']}</div></div>
</div>""")


# ── sayfalar ─────────────────────────────────────────────────────────
def p_banner(c):
    t = c.t
    css = """.canvas { width: 1500px; height: 500px; }
  .copy { position: absolute; left: 90px; top: 62px; width: 760px; z-index: 5; }
  .copy .brand { margin-bottom: 26px; } .copy .brand img { width: 50px; height: 50px; } .copy .brand span { font-size: 32px; }
  h1 { font-size: 72px; }
  .sub { margin-top: 20px; font-size: 24px; color: var(--ink-2); font-weight: 500; line-height: 1.4; max-width: 700px; }
  .wall { position: absolute; right: -120px; top: -170px; width: 860px; height: 860px; transform: rotate(-14deg);
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; }
  .col { display: flex; flex-direction: column; gap: 18px; } .col:nth-child(2n) { margin-top: -90px; }
  .col .poster { aspect-ratio: 2/3; border-radius: 14px; }
  .fade { position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(90deg, var(--bg) 0%, var(--bg) 46%, rgba(6,8,12,.75) 58%, rgba(6,8,12,.1) 78%, rgba(6,8,12,.35) 100%),
                linear-gradient(0deg, rgba(6,8,12,.6), transparent 30%, transparent 75%, rgba(6,8,12,.5)); }"""
    cols = [["movie-157336", "tv-1396", "movie-680"], ["tv-66732", "movie-27205", "tv-93405", "movie-13"],
            ["movie-155", "tv-76479", "movie-299536"], ["tv-1399", "movie-19995", "tv-71446", "movie-278"],
            ["movie-550", "tv-85271", "movie-293660"]]
    wall = "".join(f'<div class="col">{"".join(poster(p) for p in col)}</div>' for col in cols)
    return doc(c, "Banner", css, f"""<div class="canvas grain">
  <div class="glow blue" style="width:520px;height:520px;left:-160px;top:-260px"></div>
  <div class="glow violet" style="width:560px;height:560px;left:620px;bottom:-380px"></div>
  <div class="wall">{wall}</div><div class="fade"></div>
  {dev(c, "dizi-trend", 250, "left:880px; top:70px; transform: rotate(-7deg)")}
  {dev(c, "oyunlar", 250, "left:1150px; top:120px; transform: rotate(6deg)")}
  <div class="copy">{brand()}
    <h1>{t['heroA']}<br><span class="grad">{t['heroB']}</span></h1>
    <p class="sub">{t['heroSub']}</p>
  </div>
</div>""")


def p01(c):
    t = c.t
    return post(c, "Post 01", t["p1Eyebrow"], t["heroA"], t["heroB"], t["heroSub"], ["blue", "violet", "teal"],
                dev(c, "kutuphane", 330, "left:56px; top:560px; transform: rotate(-9deg)", dim=True, z=2)
                + dev(c, "wrapped", 330, "right:56px; top:560px; transform: rotate(9deg)", dim=True, z=2)
                + dev(c, "dizi-trend", 390, "left:345px; top:488px")
                + callout("▶", "tb", t["p1C1"], "left:40px; top:1010px")
                + callout("✦", "vp", t["wrappedC"], "right:40px; top:780px"),
                f"<b>iOS</b><span class='dot'></span><b>Android</b><span class='dot'></span>{t['langs']}", center=True)


def p02(c):
    t = c.t
    return post(c, "Post 02", t["p2Eyebrow"], t["p2A"], t["p2B"], t["p2Sub"], ["blue", "violet", "teal"],
                dev(c, "oscar-seri", 350, "right:70px; top:575px; transform: rotate(7deg)", dim=True, z=2)
                + dev(c, "en-iyi-diziler", 390, "left:150px; top:500px; transform: rotate(-3deg)")
                + callout("♥", "vp", t["p2C1"], "right:40px; top:560px")
                + callout("🏆", "ao", t["p2C2"], "right:40px; top:880px")
                + callout("🌍", "tb", t["p2C3"], "left:36px; top:1040px"),
                dots(t["p2Foot"]), center=True)


def p03(c):
    t = c.t
    if c.lang == "en":
        return post(c, "Post 03", t["p3Eyebrow"], t["p3A"], t["p3B"], t["p3Sub"], ["violet", "blue", "teal"],
                    dev(c, "cinematch", 410, "left:335px; top:486px")
                    + callout("✦", "bv", t["p3C1"], "right:36px; top:640px")
                    + callout("🎭", "vp", t["p3C2"], "left:36px; top:860px")
                    + callout("👥", "tb", t["p3C3"], "right:36px; top:1080px"),
                    dots(t["p3Foot"]), center=True)
    return post(c, "Post 03", t["p3Eyebrow"], t["p3A"], t["p3B"], t["p3Sub"], ["violet", "blue", "teal"],
                dev(c, "cinematch-menu", 380, "left:64px; top:500px; transform: rotate(-5deg)", dim=True, z=2)
                + shot(c, "cinematch-ruh-hali", 940, 570, 300, 1250, "right:48px; top:510px; z-index:4")
                + callout("✦", "bv", t["p3C1"], "left:36px; top:1120px"),
                dots(t["p3Foot"]))


def p04(c):
    t = c.t
    if c.lang == "en":
        return post(c, "Post 04", t["p4Eyebrow"], t["p4A"], t["p4B"], t["p4Sub"], ["blue", "amber", "violet"],
                    dev(c, "oyunlar", 390, "left:80px; top:486px; transform: rotate(-3deg)")
                    + shot(c, "turnuva-kart", 736, 500, 0, 645, "right:36px; top:500px; transform: rotate(3deg)")
                    + shot(c, "bingo", 1206, 470, 80, 704, "right:40px; top:950px; transform: rotate(-2deg)"),
                    dots(t["p4Foot"]))
    return post(c, "Post 04", t["p4Eyebrow"], t["p4A"], t["p4B"], t["p4Sub"], ["blue", "amber", "violet"],
                dev(c, "turnuva", 340, "right:60px; top:540px; transform: rotate(7deg)", dim=True, z=2)
                + dev(c, "oyunlar", 390, "left:110px; top:486px; transform: rotate(-3deg)")
                + shot(c, "bingo", 1206, 470, 0, 705, "right:36px; top:950px; transform: rotate(3deg)")
                + callout("🎬", "tb", t["p4C1"], "right:40px; top:700px"),
                dots(t["p4Foot"]))


def p05(c):
    t = c.t
    if c.lang == "en":
        return post(c, "Post 05", t["p5Eyebrow"], t["p5A"], t["p5B"], t["p5Sub"], ["pink", "blue", "teal"],
                    dev(c, "aktivite", 360, "left:56px; top:540px; transform: rotate(-6deg)", dim=True, z=2)
                    + shot(c, "zevk-uyumu", 948, 500, 0, 1512, "right:50px; top:470px; z-index:4")
                    + callout("⭐", "ao", t["p5C1"], "left:36px; top:620px")
                    + callout("❤", "rd", t["p5C3"], "left:36px; top:1080px"),
                    dots(t["p5Foot"]))
    return post(c, "Post 05", t["p5Eyebrow"], t["p5A"], t["p5B"], t["p5Sub"], ["pink", "blue", "teal"],
                dev(c, "eglence-sosyal", 410, "left:335px; top:486px")
                + callout("📝", "bv", t["p5C1"], "left:36px; top:600px")
                + callout("💬", "tb", t["p5C2"], "left:36px; top:860px")
                + callout("❤", "rd", t["p5C3"], "right:36px; top:760px")
                + callout("%", "gr", t["p5C4"], "right:36px; top:1130px"),
                dots(t["p5Foot"]), center=True)


def p06(c):
    t = c.t
    return post(c, "Post 06", t["p6Eyebrow"], t["p6A"], t["p6B"], t["p6Sub"], ["blue", "violet", "teal"],
                dev(c, "wrapped", 350, "right:64px; top:560px; transform: rotate(7deg)", dim=True, z=2)
                + dev(c, "kutuphane", 395, "left:110px; top:486px; transform: rotate(-3deg)")
                + callout("▶", "bv", t["p6C1"], "right:40px; top:620px")
                + callout("⚡", "gr", t["p6C2"], "right:40px; top:880px")
                + callout("📅", "vp", t["p6C3"], "left:36px; top:1110px"),
                dots(t["p6Foot"]))


def p07(c):
    t = c.t
    return post(c, "Post 07", t["p7Eyebrow"], t["p7A"], t["p7B"], t["p7Sub"], ["violet", "blue", "pink"],
                dev(c, "profil", 400, "left:96px; top:486px; transform: rotate(-3deg)")
                + shot(c, "etkinlikler", 1206, 480, 80, 400, "right:36px; top:990px")
                + callout("⏱", "bv", t["p7C1"], "right:40px; top:600px")
                + callout("🏅", "ao", t["p7C2"], "right:40px; top:800px"),
                dots(t["p7Foot"]))


def p09(c):
    t = c.t
    return post(c, "Post 09", t["p9Eyebrow"], t["p9A"], t["p9B"], t["p9Sub"], ["amber", "violet", "blue"],
                dev(c, "top100", 410, "left:335px; top:486px")
                + callout("🏆", "ao", t["p9C1"], "left:36px; top:640px")
                + callout("🗳️", "vp", t["p9C2"], "right:36px; top:820px")
                + callout("❓", "bv", t["p9C3"], "left:36px; top:1060px"),
                dots(t["p9Foot"]), center=True)


def p10(c):
    t = c.t
    return post(c, "Post 10", t["p10Eyebrow"], t["p10A"], t["p10B"], t["p10Sub"], ["teal", "amber", "violet"],
                dev(c, "rozetlerim", 400, "left:80px; top:486px; transform: rotate(-3deg)")
                + shot(c, "rozet-vitrin", 1124, 520, 0, 575, "right:36px; top:560px; transform: rotate(3deg)")
                + callout("🏅", "ao", t["p10C1"], "right:40px; top:880px")
                + callout("🔥", "tb", t["p10C2"], "right:40px; top:1060px"),
                dots(t["p10Foot"]))


def p11(c):
    t = c.t
    return post(c, "Post 11", t["p11Eyebrow"], t["p11A"], t["p11B"], t["p11Sub"], ["teal", "blue", "violet"],
                dev(c, "dizi-istatistik", 400, "left:80px; top:486px; transform: rotate(-3deg)")
                + shot(c, "izleme-istatistik", 1206, 500, 0, 1310, "right:36px; top:560px; transform: rotate(3deg)")
                + callout("📅", "bv", t["p11C1"], "left:36px; top:1100px"),
                dots(t["p11Foot"]))


PREMIUM_CSS = """.eyebrow.gold { color: var(--amber); border-color: rgba(255,194,71,.35); background: rgba(255,194,71,.08); }
  .eyebrow.gold i { background: var(--amber); box-shadow: 0 0 14px var(--amber); }
  .post .head { top: 176px; }
  .gold-t { background: linear-gradient(110deg, #ffe7a3, #ffc247 45%, #ff8a3d); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .plans { position: absolute; left: 72px; right: 72px; top: 526px; display: grid; grid-template-columns: 1fr 1.18fr 1fr; gap: 20px; align-items: stretch; }
  .plan { border-radius: 36px; padding: 32px 26px; display: flex; flex-direction: column; }
  .plan h3 { font-size: 34px; font-weight: 900; letter-spacing: -.02em; }
  .plan .tag { font-size: 18px; color: var(--ink-2); font-weight: 600; margin-top: 4px; min-height: 48px; line-height: 1.3; }
  .plan ul { list-style: none; margin-top: 18px; display: flex; flex-direction: column; gap: 14px; }
  .plan li { display: flex; gap: 10px; font-size: 21px; line-height: 1.3; font-weight: 600; }
  .plan li::before { content: "✓"; flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 900;
    background: rgba(255,255,255,.1); color: var(--ink); margin-top: 1px; }
  .plan .big { font-size: 40px; font-weight: 900; letter-spacing: -.03em; margin-top: auto; padding-top: 22px; line-height: 1; }
  .plan .big small { display: block; font-size: 17px; font-weight: 700; color: var(--ink-2); letter-spacing: 0; margin-top: 6px; }
  .plan.pro { position: relative; padding: 40px 30px 34px; border: 1.5px solid rgba(255,194,71,.6);
    background: linear-gradient(170deg, rgba(255,194,71,.20), rgba(139,124,246,.16) 55%, rgba(19,141,240,.12));
    box-shadow: 0 40px 100px rgba(255,160,60,.25), inset 0 1px 0 rgba(255,255,255,.25); }
  .plan.pro li::before { background: linear-gradient(135deg, #ffe7a3, #ffc247); color: #3a2400; }
  .plan.pro .crown { position: absolute; top: -24px; left: 50%; transform: translateX(-50%); padding: 10px 20px; border-radius: 999px; white-space: nowrap;
    background: linear-gradient(110deg, #ffe7a3, #ffc247 50%, #ff8a3d); color: #3a2400; font-size: 18px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; box-shadow: 0 12px 30px rgba(255,160,60,.45); }
  .plan .go { margin-top: auto; padding: 16px 0; border-radius: 999px; text-align: center; font-size: 21px; font-weight: 900; color: #3a2400; background: linear-gradient(110deg, #ffe7a3, #ffc247 50%, #ff8a3d); box-shadow: 0 14px 34px rgba(255,160,60,.4); }
  .plan.pro ul { margin-bottom: 24px; }
  .plan.max li::before { background: linear-gradient(135deg, #2ee6d6, #8b7cf6); color: #041220; }
  .perks { position: absolute; left: 72px; right: 72px; top: 1096px; display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
  .perks .chip { font-size: 19px; }
  .post .bottomfade { display: none; }"""


def p08(c):
    t = c.t
    li = lambda xs: "".join(f"<li>{x}</li>" for x in xs)
    body = f"""<div class="plans">
    <div class="plan glass"><h3>Free</h3><div class="tag">{t['freeTag']}</div><ul>{li(t['freeList'])}</ul>
      <div class="big">{t['freeBig'][0]}<small>{t['freeBig'][1]}</small></div></div>
    <div class="plan pro"><span class="crown">{t['proCrown']}</span><h3 class="gold-t">Premium</h3><div class="tag">{t['proTag']}</div>
      <ul>{li(t['proList'])}</ul><div class="go">{t['proGo']}</div></div>
    <div class="plan glass max"><h3>Max</h3><div class="tag">{t['maxTag']}</div><ul>{li(t['maxList'])}</ul>
      <div class="big">{t['maxBig'][0]}<small>{t['maxBig'][1]}</small></div></div>
  </div>
  <div class="perks">{''.join(f'<span class="chip">{p}</span>' for p in t['perks'])}</div>"""
    glows = ('<div class="glow amber" style="width:620px;height:620px;left:230px;top:420px"></div>'
             '<div class="glow violet" style="width:560px;height:560px;right:-240px;top:-180px"></div>'
             '<div class="glow teal" style="width:460px;height:460px;left:-220px;bottom:-160px"></div>')
    html = post(c, "Post 08", "Premium", t["p8A"], t["p8B"], t["p8Sub"], [], glows + body, dots(t["p8Foot"]),
                css=PREMIUM_CSS, eyebrow_cls="gold", h1b_cls="gold-t")
    return html


def p_story(c):
    t = c.t
    css = """.canvas { width: 1080px; height: 1920px; }
  .wall { position: absolute; z-index: -1; left: -200px; right: -200px; top: -260px; height: 1160px; transform: rotate(-12deg);
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 20px; }
  .col { display: flex; flex-direction: column; gap: 20px; } .col:nth-child(2n) { margin-top: -130px; }
  .col .poster { aspect-ratio: 2/3; border-radius: 18px; }
  .fade { position: absolute; z-index: -1; left: 0; right: 0; top: 0; height: 1300px;
    background: linear-gradient(180deg, rgba(6,8,12,.78) 0%, rgba(6,8,12,.86) 30%, var(--bg) 58%); }
  .mark { position: absolute; left: 50%; top: 250px; transform: translateX(-50%); width: 132px; height: 132px;
    border-radius: 34px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.6), 0 0 0 2px rgba(255,255,255,.14), 0 0 100px rgba(19,141,240,.5); }
  .mark img { width: 100%; height: 100%; }
  .head { position: absolute; left: 60px; right: 60px; top: 410px; text-align: center; }
  h1 { font-size: 90px; white-space: nowrap; }
  .head p { margin-top: 22px; font-size: 32px; color: var(--ink-2); font-weight: 500; }
  .dev.side { filter: brightness(.6) saturate(.9); }
  .ctaw { position: absolute; left: 0; right: 0; top: 1640px; text-align: center; z-index: 9; }
  .cta { font-size: 32px; padding: 26px 46px; }
  .ctaw p { margin-top: 18px; font-size: 22px; color: var(--ink-3); font-weight: 600; }
  .bf { position: absolute; left: 0; right: 0; top: 1380px; height: 540px; z-index: 8; background: linear-gradient(0deg, var(--bg) 45%, rgba(6,8,12,0)); }"""
    cols = [["movie-24428", "tv-1418", "movie-13"], ["tv-1399", "movie-157336", "tv-63174", "movie-293660"],
            ["movie-155", "tv-66732", "movie-680"], ["tv-1396", "movie-27205", "tv-93405", "movie-118340"],
            ["movie-299536", "tv-76479", "movie-278"], ["tv-71446", "movie-19995", "tv-85271", "tv-1402"],
            ["movie-550", "tv-71712", "tv-69050"]]
    wall = "".join(f'<div class="col">{"".join(poster(p) for p in col)}</div>' for col in cols)
    arrow = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" '
             'stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')
    return doc(c, "Story", css, f"""<div class="canvas grain">
  <div class="wall">{wall}</div><div class="fade"></div>
  <div class="glow blue" style="width:700px;height:520px;left:190px;top:520px;opacity:.7"></div>
  <div class="glow violet" style="width:560px;height:560px;right:-240px;top:1300px"></div>
  <div class="glow teal" style="width:520px;height:520px;left:-240px;top:1460px"></div>
  <div class="mark"><img src="{R}img/logo/icon.png"></div>
  <div class="head"><h1>{t['heroA']}<br><span class="grad">{t['heroB']}</span></h1><p>{t['storySub']}</p></div>
  {dev(c, "oyunlar", 350, "left:40px; top:800px; transform: rotate(-9deg)", dim=True, z=2)}
  {dev(c, "wrapped", 350, "right:40px; top:800px; transform: rotate(9deg)", dim=True, z=2)}
  {dev(c, "film-trend", 420, "left:330px; top:730px")}
  {callout("🏆", "ao", t["storyC1"], "left:40px; top:1250px; z-index:9")}
  {callout("✦", "vp", t["wrappedC"], "right:40px; top:1060px; z-index:9")}
  <div class="bf"></div>
  <div class="ctaw"><span class="cta">{t['storyCta']} {arrow}</span><p>{t['storyPlatforms']}</p></div>
</div>""")


PAGES = {"banner": p_banner, "post-01": p01, "post-02": p02, "post-03": p03, "post-04": p04, "post-05": p05,
         "post-06": p06, "post-07": p07, "post-08": p08, "post-09": p09, "post-10": p10, "post-11": p11,
         "hikaye-01": p_story}


def profile_icon():
    css = """.canvas { width: 1080px; height: 1080px; background:
    radial-gradient(circle at 50% 45%, #1b2a6b 0%, #10154a 38%, #080a24 72%, #05060f 100%); }
  .ring { position: absolute; inset: 120px; border-radius: 50%;
    background: conic-gradient(from 200deg, rgba(46,230,214,.0), rgba(46,230,214,.35), rgba(19,141,240,.45), rgba(139,124,246,.45), rgba(46,230,214,0));
    filter: blur(60px); opacity: .8; }
  .mark { position: absolute; left: 50%; top: 50%; width: 640px; height: 640px; transform: translate(-52.5%, -50%);
    filter: drop-shadow(0 30px 60px rgba(5, 10, 40, .8)) drop-shadow(0 0 80px rgba(19,141,240,.35)); }"""
    return f"""<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="{R}base.css"><style>{css}</style></head>
<body><div class="canvas grain">
  <div class="glow violet" style="width:620px;height:620px;right:-200px;top:-220px"></div>
  <div class="glow teal" style="width:520px;height:520px;left:-200px;bottom:-200px"></div>
  <div class="ring"></div><img class="mark" src="{R}img/logo/s-mark-tight.png" alt="">
</div></body></html>"""


def render(html, html_path, png_path, size):
    html_path.parent.mkdir(parents=True, exist_ok=True)
    png_path.parent.mkdir(parents=True, exist_ok=True)
    html_path.write_text(html, encoding="utf-8")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--allow-file-access-from-files", "--virtual-time-budget=6000",
                    f"--window-size={size[0]},{size[1]}", f"--screenshot={png_path}", html_path.as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("✓", png_path.relative_to(ROOT))


def main(argv):
    langs = [a for a in argv if a in LANGS] or LANGS
    only = [a for a in argv if a not in LANGS]
    pick = lambda key: not only or any(key.startswith(o) for o in only)
    if pick("profil"):
        render(profile_icon(), SRC / "_html" / "ortak" / "profil-ikonu.html",
               OUT / "ortak" / "seelogd-profil-ikonu.png", (1080, 1080))
    for lang in langs:
        c = Ctx(lang)
        for key, fn in PAGES.items():
            if not pick(key) or lang not in SLUGS[key]:
                continue
            folder, slug = SLUGS[key][lang]
            render(fn(c), SRC / "_html" / lang / f"{slug}.html",
                   OUT / lang / folder / f"seelogd-{lang}-{slug}.png", SIZES.get(key, (1080, 1350)))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
