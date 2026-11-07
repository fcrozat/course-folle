/* ============================================================================
   MAIN — routeur d'écrans, entrées (tactile + clavier), boucle de jeu.
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  var dom = CF.dom, el = dom.el, clear = dom.clear, into = dom.into;

  var canvas, vm, attract = null, race = null;
  var last = 0;
  var screen = 'title';
  var resultsShown = false;

  // ------------------------------------------------------------------- écrans
  function goto(name) {
    screen = name;
    CF.screen = name;
    var nodes = document.querySelectorAll('.screen');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('active');
    var target = document.getElementById('screen-' + name);
    if (target) target.classList.add('active');

    var hud = document.getElementById('hud');
    var inRace = (name === 'race' || name === 'pause');
    if (hud) hud.hidden = !inRace;
    canvas.classList.toggle('racing', name === 'race' || name === 'pause' || name === 'results');
    document.body.classList.toggle('racing', name === 'race');

    if (name === 'title' || name === 'char' || name === 'dress') {
      if (race) { race.stop(); race = null; }
      if (!attract) { attract = new CF.Attract(canvas); attract.resize(vm); CF.attract = attract; }
    }
    if (name !== 'pause' && race) race.resume();
  }

  function startRace() {
    var sel = CF.Dress.get();
    attract = null; CF.attract = null;
    resultsShown = false;
    race = new CF.Race(canvas, { onPauseRequest: function () { goto('pause'); } });
    race.resize(vm);
    race.setup(sel.charId, sel.outfit, [CF.randomOutfit(), CF.randomOutfit(), CF.randomOutfit()]);
    goto('race');
  }

  function togglePause() {
    if (!race) return;
    if (screen === 'race') { race.pause(); goto('pause'); CF.Audio.play('click'); }
    else if (screen === 'pause') { race.resume(); goto('race'); CF.Audio.play('click'); }
  }

  // --------------------------------------------------------------- résultats
  function showResults() {
    if (!race || !race.result || resultsShown) return;
    resultsShown = true;
    var r = race.result;
    CF.Audio.play('place', r.rank);

    var titles = ['🥇 VICTOIRE !', '🥈 Deuxième !', '🥉 Troisième !', '😅 Quatrième !'];
    var lines = r.rank === 0 ? CF.resultLines.win : r.rank === 3 ? CF.resultLines.last : CF.resultLines.close;
    document.getElementById('uiResultTitle').textContent = titles[r.rank];
    document.getElementById('uiResultSub').textContent = lines[Math.floor(Math.random() * lines.length)];

    var box = document.getElementById('uiRanking');
    clear(box);
    r.order.forEach(function (row, i) {
      var isMe = row.id === race.charId;
      var item = el('div', 'rank-row' + (isMe ? ' me' : ''));
      item.style.animationDelay = (i * 0.16) + 's';
      var cv = el('canvas', 'rank-face');
      cv.width = 52; cv.height = 52;
      into(item,
        el('span', 'rank-medal', CF.RACE_KIND[i]),
        cv,
        into(el('span', 'rank-name'),
          document.createTextNode(row.name),
          isMe ? el('small', null, ' (toi)') : null));
      box.appendChild(item);
      var d = dom.canvas2d(cv);
      CF.draw.face(d.ctx, row.id, d.w, row.outfit);
      setTimeout(function () { CF.Audio.play('place', 3 - i); }, 160 * i + 120);
    });

    var st = document.getElementById('uiRaceStats');
    clear(st);
    [
      ['🍬', 'Bonbons', String(r.candies)],
      ['💥', 'Chutes', String(r.bumps)],
      ['🦘', 'Plus long saut', r.bestAir.toFixed(1) + ' s'],
      ['📏', 'Distance', r.meters + ' m'],
    ].forEach(function (s) {
      into(st, into(el('div', 'rs'), el('span', 'rs-ico', s[0]), el('span', 'rs-label', s[1]), el('b', null, s[2])));
    });

    goto('results');
  }

  // ------------------------------------------------------------------ entrées
  function bindInput() {
    // tactile + souris : n'importe où sur le monde = sauter
    document.addEventListener('pointerdown', function (ev) {
      CF.Audio.unlock();
      if (ev.target.closest && ev.target.closest('button, .screen')) return;
      if (screen !== 'race' || !race) return;
      ev.preventDefault();
      race.press();
    }, { passive: false });

    var up = function (ev) {
      if (ev.target.closest && ev.target.closest('button, .screen')) return;
      if (race) race.release();
    };
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);

    document.addEventListener('keydown', function (ev) {
      var k = ev.code || ev.key;
      if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW' || k === ' ' || k === 'ArrowUp') {
        ev.preventDefault();
        CF.Audio.unlock();
        if (screen === 'race' && race) {
          if (!ev.repeat) race.press(); else race.holding = true;
        } else if (screen === 'title') { start(); }
        else if (screen === 'char') { goto('dress'); }
        else if (screen === 'results') { startRace(); }
        else if (screen === 'help') { goto('title'); }
        // (dans le vestiaire, Espace ne lance rien : on évite les départs accidentels)
      } else if (k === 'Escape' || k === 'KeyP') {
        ev.preventDefault();
        if (screen === 'race' || screen === 'pause') togglePause();
      } else if (k === 'Enter') {
        if (screen === 'title') start();
        else if (screen === 'char') goto('dress');
        else if (screen === 'dress') startRace();
        else if (screen === 'results') startRace();
      }
    });

    // la tablette se met en veille ou l'enfant change d'appli : on met en pause
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && screen === 'race' && race) { race.pause(); goto('pause'); }
    });
    window.addEventListener('blur', function () {
      if (screen === 'race' && race) { race.pause(); goto('pause'); }
    });

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
  }

  function bindButtons() {
    function on(id, fn) {
      var n = document.getElementById(id);
      if (n) n.addEventListener('click', function (ev) { ev.preventDefault(); CF.Audio.unlock(); CF.Audio.play('click'); fn(); });
    }
    function start() { CF.Audio.unlock(); goto('char'); }
    window.CF._start = start;

    on('btnPlay', start);
    on('btnHow', function () { goto('help'); });
    on('btnHelpBack', function () { goto('title'); });
    on('btnToWardrobe', function () { goto('dress'); });
    on('btnStart', startRace);
    on('btnRandom', function () { CF.Dress.randomOutfit(); });
    on('btnNaked', function () { CF.Dress.strip(); });
    on('btnPause', togglePause);
    on('btnResume', togglePause);
    on('btnRestart', startRace);
    on('btnQuit', function () { goto('title'); });
    on('btnAgain', startRace);
    on('btnChangeOutfit', function () { goto('dress'); });
    on('btnMenu', function () { goto('title'); });

    var backs = document.querySelectorAll('[data-goto]');
    for (var i = 0; i < backs.length; i++) {
      (function (node) {
        node.addEventListener('click', function (ev) {
          ev.preventDefault(); CF.Audio.play('back'); goto(node.dataset.goto);
        });
      })(backs[i]);
    }

    var muteBtns = ['btnMute', 'btnMute2'];
    muteBtns.forEach(function (id) {
      var n = document.getElementById(id);
      if (!n) return;
      n.addEventListener('click', function (ev) {
        ev.preventDefault();
        var m = CF.Audio.toggle();
        syncMute();
      });
    });

    var full = document.getElementById('btnFull');
    if (full) {
      full.addEventListener('click', function (ev) {
        ev.preventDefault();
        var d = document.documentElement;
        if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(noop); }
        else if (d.requestFullscreen) { d.requestFullscreen().catch(noop); }
      });
    }
  }

  function noop() { /* le navigateur refuse : pas grave */ }

  function syncMute() {
    var m = CF.Audio.isMuted();
    ['btnMute', 'btnMute2'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) { n.textContent = m ? '🔇' : '🔊'; n.classList.toggle('off', m); }
    });
  }

  // ------------------------------------------------------------------ redim.
  function resize() {
    var dpr = Math.min(2.5, window.devicePixelRatio || 1);
    var cssW = window.innerWidth, cssH = window.innerHeight;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    vm = CF.viewMetrics(cssW, cssH);
    vm.dpr = dpr;
    if (attract) attract.resize(vm);
    if (race) race.resize(vm);
  }

  // -------------------------------------------------------------------- boucle
  function frame(ts) {
    var dt = last ? (ts - last) / 1000 : 0;
    last = ts;
    if (dt > 0.05) dt = 0.05;         // retour d'onglet : on ne saute pas dans le futur
    if (dt < 0) dt = 0;

    if (race && (screen === 'race' || screen === 'pause' || screen === 'results')) {
      if (screen === 'race') {
        if (race.finished) { if (race.afterFinish(dt)) showResults(); }
        else race.update(dt);
      }
      race.draw();
    } else if (attract) {
      attract.update(dt);
      attract.draw();
    }

    CF.Dress.tick(dt);
    requestAnimationFrame(frame);
  }

  function start() { goto('char'); }

  // --------------------------------------------------------------------- boot
  CF.boot = function () {
    canvas = document.getElementById('game');
    resize();
    bindButtons();
    bindInput();
    CF.Dress.init();
    attract = new CF.Attract(canvas);
    attract.resize(vm);
    CF.attract = attract;
    syncMute();
    goto('title');
    // raccourci pratique (et utile pour tester) : index.html#auto=race|dress|char|results
    var auto = /^#auto=(\w+)/.exec(window.location.hash || '');
    if (auto) {
      if (auto[1] === 'race') startRace();
      else if (auto[1] === 'dress') goto('dress');
      else if (auto[1] === 'char') goto('char');
      else if (auto[1] === 'action') {
        // place le joueur en plein saut au-dessus d'un obstacle (pour vérifier le rendu)
        startRace();
        race.countdown = 0;
        var dta = 1 / 60, ta = 0;
        var near = function () {
          var best = Infinity;
          for (var e2 = 0; e2 < race.entities.length; e2++) {
            var en = race.entities[e2];
            if (en.kind !== 'obs' || en.dead || !en.type.ground) continue;
            var d2 = en.x - race.dist;
            if (d2 > 0 && d2 < best) best = d2;
          }
          return best;
        };
        while (ta < 60 && near() > 150) { race.update(dta); ta += dta; }
        race.press();
        for (var jj = 0; jj < 12; jj++) race.update(dta);
      }
      else if (auto[1] === 'results') {
        startRace();
        var dt = 1 / 60, t = 0;
        while (t < 240 && !race.finished) { race.update(dt); t += dt; }
        var guard = 0;
        while (!race.afterFinish(dt) && guard++ < 600) { /* célébration */ }
        showResults();
      }
    }
    requestAnimationFrame(frame);
  };

  CF.debug = {
    get race() { return race; },
    get screen() { return screen; },
    goto: goto,
    startRace: startRace,
    showResults: showResults,
  };
})(window.CF);
