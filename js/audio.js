/* ============================================================================
   Sons : tout est généré en WebAudio, aucun fichier à télécharger.
   Le contexte audio est créé au premier geste (obligatoire sur tablette).
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var ready = false;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function resume() {
    var c = ensure();
    if (c && c.state === 'suspended' && c.resume) { c.resume().catch(function () { /* navigateur réticent : on réessaiera au prochain geste */ }); }
  }

  // une note simple avec enveloppe
  function tone(opt) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (opt.delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.f0, t0);
    if (opt.f1 && opt.f1 !== opt.f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t0 + (opt.dur || 0.15));
    }
    var vol = (opt.vol == null ? 0.3 : opt.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opt.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opt.dur || 0.15));
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + (opt.dur || 0.15) + 0.05);
  }

  // bruit blanc court (pour les « plop », chocs, pas)
  function noise(opt) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    opt = opt || {};
    var dur = opt.dur || 0.12;
    var t0 = c.currentTime + (opt.delay || 0);
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, Math.max(1, len), c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var k = 1 - i / len;
      d[i] = (Math.random() * 2 - 1) * k * k;
    }
    var src = c.createBufferSource();
    src.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = opt.filter || 'lowpass';
    f.frequency.value = opt.freq || 900;
    var g = c.createGain();
    g.gain.value = opt.vol == null ? 0.35 : opt.vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  var SFX = {
    click: function () { tone({ f0: 620, f1: 880, dur: 0.07, type: 'triangle', vol: 0.22 }); },
    back: function () { tone({ f0: 520, f1: 300, dur: 0.1, type: 'triangle', vol: 0.22 }); },
    select: function () {
      tone({ f0: 660, f1: 990, dur: 0.09, type: 'triangle', vol: 0.25 });
      tone({ f0: 990, f1: 1320, dur: 0.1, type: 'triangle', vol: 0.18, delay: 0.07 });
    },
    dress: function () { noise({ dur: 0.1, freq: 2600, vol: 0.18, filter: 'highpass' }); tone({ f0: 480, f1: 720, dur: 0.08, type: 'square', vol: 0.12 }); },
    jump: function (power) {
      var p = 1 + (power || 0) * 0.2;
      tone({ f0: 300 * p, f1: 720 * p, dur: 0.18, type: 'sine', vol: 0.28 });
      noise({ dur: 0.07, freq: 1400, vol: 0.1 });
    },
    doubleJump: function () {
      tone({ f0: 520, f1: 1100, dur: 0.16, type: 'triangle', vol: 0.26 });
      tone({ f0: 780, f1: 1560, dur: 0.14, type: 'sine', vol: 0.16, delay: 0.05 });
    },
    flap: function () { noise({ dur: 0.09, freq: 1800, vol: 0.09, filter: 'bandpass' }); },
    land: function () { noise({ dur: 0.1, freq: 420, vol: 0.22 }); },
    candy: function (n) {
      var base = 880 * Math.pow(1.0595, Math.min(12, (n || 0)) * 1.5);
      tone({ f0: base, f1: base * 1.5, dur: 0.1, type: 'triangle', vol: 0.22 });
    },
    bump: function () {
      tone({ f0: 200, f1: 60, dur: 0.3, type: 'sawtooth', vol: 0.3 });
      noise({ dur: 0.25, freq: 500, vol: 0.3 });
    },
    shield: function () {
      tone({ f0: 1200, f1: 400, dur: 0.25, type: 'square', vol: 0.18 });
      noise({ dur: 0.2, freq: 3000, vol: 0.12, filter: 'highpass' });
    },
    boost: function () {
      tone({ f0: 220, f1: 1400, dur: 0.5, type: 'sawtooth', vol: 0.22 });
      tone({ f0: 330, f1: 2100, dur: 0.45, type: 'triangle', vol: 0.14, delay: 0.05 });
      noise({ dur: 0.5, freq: 2200, vol: 0.14, filter: 'highpass' });
    },
    stomp: function () {
      tone({ f0: 150, f1: 50, dur: 0.18, type: 'square', vol: 0.24 });
      noise({ dur: 0.16, freq: 700, vol: 0.22 });
    },
    pop: function () { tone({ f0: 900, f1: 1600, dur: 0.06, type: 'sine', vol: 0.2 }); },
    zone: function () {
      noise({ dur: 0.5, freq: 3200, vol: 0.16, filter: 'highpass' });
      tone({ f0: 400, f1: 1200, dur: 0.35, type: 'triangle', vol: 0.2 });
      tone({ f0: 600, f1: 1800, dur: 0.3, type: 'sine', vol: 0.14, delay: 0.12 });
    },
    count: function (hi) { tone({ f0: hi ? 1000 : 620, dur: 0.12, type: 'triangle', vol: 0.3 }); },
    win: function () {
      var notes = [523, 659, 784, 1046, 1318];
      notes.forEach(function (f, i) {
        tone({ f0: f, dur: 0.28, type: 'triangle', vol: 0.3, delay: i * 0.13 });
        tone({ f0: f * 2, dur: 0.2, type: 'sine', vol: 0.12, delay: i * 0.13 + 0.02 });
      });
      noise({ dur: 0.8, freq: 4000, vol: 0.08, filter: 'highpass', delay: 0.1 });
    },
    lose: function () {
      var notes = [523, 466, 392, 311];
      notes.forEach(function (f, i) { tone({ f0: f, dur: 0.3, type: 'sine', vol: 0.26, delay: i * 0.16 }); });
    },
    place: function (rank) {
      var f = rank === 0 ? 1046 : rank === 1 ? 784 : rank === 2 ? 622 : 466;
      tone({ f0: f, f1: f * 1.25, dur: 0.18, type: 'triangle', vol: 0.26 });
    },
  };

  CF.Audio = {
    unlock: function () { resume(); ready = true; },
    isReady: function () { return ready; },
    play: function (name, arg) {
      if (!ctx) { if (!ready) return; ensure(); }
      resume();
      var fn = SFX[name];
      if (fn) { try { fn(arg); } catch { /* le son n'est pas vital */ } }
    },
    setMuted: function (m) { muted = !!m; return muted; },
    isMuted: function () { return muted; },
    toggle: function () { muted = !muted; if (!muted) { resume(); SFX.click(); } return muted; },
  };
})(window.CF);
