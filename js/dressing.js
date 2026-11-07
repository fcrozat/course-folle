/* ============================================================================
   VESTIAIRE — choix du personnage + habillage (écrans HTML pilotés en JS).
   Le DOM est construit à la main (createElement/textContent), jamais en HTML brut.
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  var STORE_KEY = 'courseFolle.tenue.v1';

  var state = {
    charId: 'momo',
    outfit: { tete: null, torse: null, pieds: null, main: null },
    slot: 'tete',
    t: 0,
    cards: [],       // {canvas, ctx, charId, outfit}
    preview: null,
    pop: 0,          // petite animation quand on change de vêtement
  };

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ c: state.charId, o: state.outfit })); } catch { /* stockage indisponible : tant pis */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d && CF.CHARACTERS[d.c]) state.charId = d.c;
      if (d && d.o) {
        CF.SLOTS.forEach(function (s) {
          var id = d.o[s.id];
          state.outfit[s.id] = (id && CF.CLOTHES[id] && CF.CLOTHES[id].slot === s.id) ? id : null;
        });
      }
    } catch { /* données illisibles : on repart de zéro */ }
  }

  // ------------------------------------------------------------- DOM helpers
  var el = CF.dom.el, clear = CF.dom.clear, into = CF.dom.into;
  var dots = CF.dom.dots, dprCanvas = CF.dom.canvas2d;

  // --------------------------------------------- écran « choix du personnage »
  function buildCharScreen() {
    var grid = document.getElementById('charGrid');
    clear(grid);
    state.cards = [];

    CF.CHARACTER_ORDER.forEach(function (id) {
      var c = CF.CHARACTERS[id];
      var bars = CF.statBars(CF.buildStats(id, {}));
      var card = el('button', 'char-card');
      card.type = 'button';
      card.dataset.char = id;

      var cv = el('canvas', 'char-cv');
      cv.width = 150; cv.height = 150;

      var mini = el('div', 'mini-stats');
      [['💨', 0], ['🦘', 1], ['🎈', 2]].forEach(function (p) {
        into(mini, into(el('span', 'mini-stat'), document.createTextNode(p[0]), dots(bars[p[1]].v)));
      });

      var talent = el('div', 'char-talent');
      into(talent, el('b', null, 'Talent : '), document.createTextNode(c.talent.name + ' — ' + c.talent.desc));

      var info = into(el('div', 'char-info'),
        el('div', 'char-name', c.name),
        el('div', 'char-title', c.title),
        el('div', 'char-blurb', c.blurb),
        talent, mini);

      into(card, cv, info);
      card.addEventListener('click', function () { selectChar(id); });
      grid.appendChild(card);

      state.cards.push({ canvas: cv, charId: id, card: card, t: Math.random() * 10, outfit: CF.randomOutfit() });
    });

    refreshCharSelection();
  }

  function selectChar(id) {
    if (state.charId === id) return;
    state.charId = id;
    state.pop = 1;
    CF.Audio.play('select');
    refreshCharSelection();
    save();
    if (CF.attract) CF.attract.setOutfit(state.charId, state.outfit);
  }

  function refreshCharSelection() {
    var btn = document.getElementById('btnToWardrobe');
    state.cards.forEach(function (c) {
      var on = c.charId === state.charId;
      c.card.classList.toggle('sel', on);
      c.card.setAttribute('aria-pressed', String(on));
    });
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Habiller ' + CF.CHARACTERS[state.charId].name + ' →';
    }
    var tip = document.getElementById('charTip');
    if (tip) tip.textContent = CF.CHARACTERS[state.charId].talent.desc;
  }

  // ------------------------------------------------------------- le vestiaire
  function buildWardrobe() {
    var tabs = document.getElementById('uiSlots');
    clear(tabs);
    CF.SLOTS.forEach(function (s) {
      var b = el('button', 'slot-tab' + (s.id === state.slot ? ' sel' : ''));
      b.type = 'button';
      b.dataset.slot = s.id;
      var badge = el('i', 'slot-badge');
      badge.id = 'badge-' + s.id;
      into(b, el('span', 'slot-ico', s.icon), el('span', null, s.name), badge);
      b.addEventListener('click', function () {
        state.slot = s.id;
        CF.Audio.play('click');
        Array.prototype.forEach.call(tabs.children, function (c) { c.classList.toggle('sel', c.dataset.slot === s.id); });
        buildItems();
      });
      tabs.appendChild(b);
    });

    document.getElementById('uiItems').addEventListener('click', function (ev) {
      var b = ev.target.closest('.item');
      if (!b) return;
      var id = b.dataset.item;
      setItem(state.slot, id === 'none' ? null : id);
    });

    state.preview = { canvas: document.getElementById('preview') };
    buildItems();
    refreshWardrobe();
  }

  function buildItems() {
    var grid = document.getElementById('uiItems');
    clear(grid);
    var slot = null;
    CF.SLOTS.forEach(function (s) { if (s.id === state.slot) slot = s; });

    var none = el('button', 'item none' + (state.outfit[slot.id] ? '' : ' sel'));
    none.type = 'button';
    none.dataset.item = 'none';
    into(none, el('span', 'item-ico', '🚫'), el('span', 'item-name', slot.none));
    grid.appendChild(none);

    Object.keys(CF.CLOTHES).forEach(function (id) {
      var it = CF.CLOTHES[id];
      if (it.slot !== slot.id) return;
      var b = el('button', 'item' + (state.outfit[slot.id] === id ? ' sel' : ''));
      b.type = 'button';
      b.dataset.item = id;
      into(b, el('span', 'item-ico', it.icon), el('span', 'item-name', it.name), el('span', 'item-mods', effectLabel(it)));
      b.addEventListener('mouseenter', function () { showDesc(it.desc); });
      b.addEventListener('focus', function () { showDesc(it.desc); });
      grid.appendChild(b);
    });

    var cur = state.outfit[slot.id];
    showDesc(cur ? CF.CLOTHES[cur].desc : 'Rien du tout : simple, léger, et un peu frissonnant.');
  }

  function effectLabel(it) {
    var m = it.mods || {}, out = [];
    if (m.speed) out.push((m.speed > 0 ? '+' : '') + Math.round(m.speed * 100) + '% 💨');
    if (m.jump) out.push((m.jump > 0 ? '+' : '') + Math.round(m.jump * 100) + '% 🦘');
    if (m.gravity) out.push((m.gravity < 0 ? 'plus léger' : 'plus lourd') + ' 🎈');
    if (m.doubleJump) out.push('double saut 🚁');
    if (m.shield) out.push('bouclier 🛡️');
    if (m.bounce) out.push('rebond 🦆');
    if (m.magnet && m.magnet > 1) out.push('aimant 🧲');
    if (m.candy) out.push((m.candy > 0 ? '+' : '') + Math.round(m.candy * 100) + '% 🍬');
    return out.join(' · ');
  }

  function setItem(slot, id) {
    if (state.outfit[slot] === id) return;
    state.outfit[slot] = id;
    state.pop = 1;
    CF.Audio.play(id ? 'dress' : 'back');
    buildItems();
    refreshWardrobe();
    save();
    if (CF.attract) CF.attract.setOutfit(state.charId, state.outfit);
  }

  function refreshBadges() {
    CF.SLOTS.forEach(function (s) {
      var b = document.getElementById('badge-' + s.id);
      if (b) b.textContent = state.outfit[s.id] ? CF.CLOTHES[state.outfit[s.id]].icon : '';
    });
  }

  function showDesc(text) {
    var d = document.getElementById('uiItemDesc');
    if (d) d.textContent = text;
  }

  function refreshWardrobe() {
    var c = CF.CHARACTERS[state.charId];
    var name = document.getElementById('uiCharName');
    if (name) { clear(name); into(name, document.createTextNode(c.name + ' '), el('small', null, c.title)); }

    var tal = document.getElementById('uiCharTalent');
    if (tal) { clear(tal); into(tal, el('b', null, c.talent.name), document.createTextNode(' — ' + c.talent.desc)); }

    var stats = CF.buildStats(state.charId, state.outfit);
    var box = document.getElementById('uiStats');
    if (box) {
      clear(box);
      CF.statBars(stats).forEach(function (s) {
        var bar = el('span', 'stat-bar');
        bar.appendChild(el('i', null, null)).style.width = Math.round(s.v * 100) + '%';
        into(box, into(el('div', 'stat-row'), el('span', 'stat-ico', s.icon), el('span', 'stat-label', s.label), bar));
      });
    }
    var powers = CF.statPowers(stats);
    var pb = document.getElementById('uiPowers');
    if (pb) {
      clear(pb);
      if (!powers.length) pb.appendChild(el('span', 'power empty', 'Aucun pouvoir magique… pour l’instant !'));
      powers.forEach(function (p) { pb.appendChild(el('span', 'power', p.icon + ' ' + p.label)); });
    }
    refreshBadges();
  }

  // ------------------------------------------------------------ aperçu animé
  function drawPreview(dt) {
    if (!state.preview || !state.preview.canvas) return;
    var d = dprCanvas(state.preview.canvas);
    var ctx = d.ctx, w = d.w, h = d.h;
    ctx.clearRect(0, 0, w, h);

    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fff7fb'); g.addColorStop(1, '#ffe3f0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffc9de';
    ctx.beginPath(); ctx.ellipse(w / 2, h - 34, w * 0.42, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(w / 2, h - 40, w * 0.32, 18, 0, 0, Math.PI * 2); ctx.stroke();

    for (var i = 0; i < 12; i++) {
      var cx = ((i * 53 + state.t * 26) % (w + 30)) - 15;
      var cy = ((i * 91 + state.t * 34) % (h + 20)) - 10;
      ctx.globalAlpha = 0.5;
      CF.gfx.fill(ctx, ['#ffd43b', '#4dabf7', '#69db7c', '#ff85a2'][i % 4], cx, cy, 3.5, 3.5);
      ctx.globalAlpha = 1;
    }

    var pop = state.pop;
    var s = 1 + Math.sin(pop * Math.PI) * 0.06;
    var pose = CF.draw.defaultPose();
    pose.phase = state.t * 9;
    pose.t = state.t;
    pose.joy = 0.15;

    ctx.save();
    ctx.translate(w / 2, h - 44);
    ctx.scale(1.22 * s, 1.22 * s);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath(); ctx.ellipse(0, 2, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
    CF.draw.runner(ctx, state.charId, state.outfit, pose, 1);
    ctx.restore();

    if (state.pop > 0) {
      state.pop = Math.max(0, state.pop - dt * 3);
      for (var k = 0; k < 6; k++) {
        var a = k / 6 * Math.PI * 2 + state.t;
        var r = 40 + (1 - state.pop) * 70;
        ctx.globalAlpha = state.pop;
        CF.gfx.star(ctx, w / 2 + Math.cos(a) * r, h - 90 + Math.sin(a) * r * 0.6, 7 * state.pop, 5);
        ctx.fillStyle = '#ffd43b'; ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawCards(dt) {
    state.cards.forEach(function (card) {
      card.t += dt;
      var d = dprCanvas(card.canvas);
      var ctx = d.ctx, w = d.w, h = d.h;
      ctx.clearRect(0, 0, w, h);
      var on = card.charId === state.charId;
      var pose = CF.draw.defaultPose();
      pose.phase = card.t * (on ? 10 : 5);
      pose.t = card.t;
      pose.joy = on ? 0.35 : 0;
      ctx.save();
      ctx.translate(w / 2, h - 16);
      ctx.scale(0.92, 0.92);
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath(); ctx.ellipse(0, 2, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
      // le champion choisi porte la tenue en cours d'essayage
      CF.draw.runner(ctx, card.charId, on ? state.outfit : card.outfit, pose, 1);
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------- API public
  CF.Dress = {
    init: function () {
      load();
      buildCharScreen();
      buildWardrobe();
    },
    tick: function (dt) {
      state.t += dt;
      if (CF.screen === 'dress') drawPreview(dt);
      else if (CF.screen === 'char') drawCards(dt);
    },
    get: function () { return { charId: state.charId, outfit: Object.assign({}, state.outfit) }; },
    randomOutfit: function () {
      state.outfit = CF.randomOutfit();
      state.pop = 1;
      CF.Audio.play('dress');
      buildItems();
      refreshWardrobe();
      save();
      if (CF.attract) CF.attract.setOutfit(state.charId, state.outfit);
    },
    strip: function () {
      CF.SLOTS.forEach(function (s) { state.outfit[s.id] = null; });
      state.pop = 1;
      CF.Audio.play('back');
      buildItems();
      refreshWardrobe();
      save();
      if (CF.attract) CF.attract.setOutfit(state.charId, state.outfit);
    },
    refresh: refreshWardrobe,
  };
})(window.CF);
