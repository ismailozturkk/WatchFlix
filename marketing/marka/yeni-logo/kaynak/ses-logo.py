# Logo animasyonu sesi: dönüşle hızlanan uğultu, çarpışma, parıltı, göz bebeği, harf tıkları, kapanış akoru.
# python ses-logo.py <theta.json> <çıkış.wav>
import json, sys, wave
import numpy as np

SR = 48000
DUR = 6.4
TM, TB = 2.45, 3.05
th = json.load(open(sys.argv[1]))
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(5)

def env(a, d, start, length=None):
    """Hızlı yükselen, üstel sönen zarf."""
    e = np.zeros(N)
    i0 = int(start * SR)
    n = N - i0 if length is None else min(N - i0, int(length * SR))
    k = np.arange(n) / SR
    e[i0:i0 + n] = np.minimum(1, k / max(a, 1e-4)) * np.exp(-k / d)
    return e

def lowpass(x, fc):
    # Tek kutuplu, zamanla değişebilir kesim (dizi verilebilir).
    fc = np.broadcast_to(fc, x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y

out = np.zeros((N, 2))

# 1) Dönüş uğultusu: gürültü, kesim frekansı yükselir; her yarım turda nabız (iki yıldız).
ang = np.interp(t, np.arange(len(th['th'])) * th['dt'], th['th'])
rise = np.clip((t - 0.25) / (TM - 0.25), 0, 1)
fade = np.where(t < TM, 1.0, np.exp(-(t - TM) / 0.08))
noise = rng.standard_normal(N)
fc = 250 + 3200 * rise ** 2.2
swish = lowpass(noise, fc) - lowpass(noise, fc * 0.35)
pulse = 0.55 + 0.45 * np.cos(2 * ang) ** 2
amp = (rise ** 1.6) * fade * pulse
pan = 0.5 + 0.35 * np.sin(ang)  # yıldızlar dönerken ses sağa sola gezer
out[:, 0] += swish * amp * (1 - pan) * 1.6
out[:, 1] += swish * amp * pan * 1.6
# Altta yükselen ton (ritim duygusu)
f_rise = 55 + 55 * rise ** 2
ph = 2 * np.pi * np.cumsum(f_rise) / SR
out += (np.sin(ph) * 0.18 * rise ** 2 * fade)[:, None]

# 2) Çarpışma: alt bas düşüşü + gürültü patlaması + parlak şın.
k = np.clip(t - TM, 0, None)
f_boom = 38 + 70 * np.exp(-k / 0.09)
boom = np.sin(2 * np.pi * np.cumsum(f_boom) / SR) * env(0.002, 0.55, TM)
burst = lowpass(rng.standard_normal(N), 1800) * env(0.001, 0.12, TM) * 1.4
shing = sum(np.sin(2 * np.pi * f * t + i) / (i + 1) for i, f in enumerate([2093, 2637, 3136, 4186, 5274]))
shing = shing * env(0.004, 0.65, TM) * 0.22
out += (boom * 0.9 + burst)[:, None]
out[:, 0] += shing * 0.9; out[:, 1] += shing * 1.1

# 3) Göz bebeği: kısa "pop".
def blip(start, f0, f1, d, g):
    kk = np.clip(t - start, 0, None)
    f = f1 + (f0 - f1) * np.exp(-kk / (d * 0.5))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.001, d, start, d * 5) * g
out += blip(TB - 0.02, 1100, 520, 0.06, 0.35)[:, None]
# Kırpma: iki yumuşak tık
out += (blip(3.76, 2400, 1800, 0.012, 0.12) + blip(3.92, 2600, 2000, 0.012, 0.12))[:, None]

# 4) Harf tıkları ve ışık süpürmesi.
for i in range(7):
    b = blip(4.35 + i * 0.055 + 0.08, 3200 + i * 120, 2600, 0.01, 0.07)
    p = i / 6
    out[:, 0] += b * (1 - p * 0.6); out[:, 1] += b * (0.4 + p * 0.6)
sweep = lowpass(rng.standard_normal(N), 6000) - lowpass(rng.standard_normal(N), 2500)
sw = np.clip((t - 4.75) / 0.55, 0, 1)
out[:, 0] += sweep * np.sin(np.pi * sw) ** 2 * 0.06 * (1 - sw)
out[:, 1] += sweep * np.sin(np.pi * sw) ** 2 * 0.06 * sw

# 5) Kapanış akoru (Cmaj9, yumuşak giriş, sona kadar söner).
chord = np.zeros(N)
for f, g in [(130.81, .5), (196.0, .35), (261.63, .35), (329.63, .28), (493.88, .18), (587.33, .14)]:
    chord += g * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.001 * t))
ce = np.clip((t - TB) / 0.9, 0, 1) ** 2 * np.clip((DUR - t) / 1.2, 0, 1)
out[:, 0] += chord * ce * 0.07
out[:, 1] += np.roll(chord, 240) * ce * 0.07

# Son: yumuşak sınırlama ve tepe -1 dBFS.
out = np.tanh(out * 1.2) / np.tanh(1.2)
out *= 10 ** (-1 / 20) / np.max(np.abs(out))
fi = int(0.01 * SR)
out[:fi] *= np.linspace(0, 1, fi)[:, None]; out[-fi:] *= np.linspace(1, 0, fi)[:, None]
pcm = (out * 32767).astype('<i2')
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', sys.argv[2])
