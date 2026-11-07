/* ============================================================================
   TEST — simulation de course complète sous Node, sans navigateur.
   Vérifie : la physique du saut, l'équité des obstacles (tout est sautable),
   le ramassage des bonbons, le changement de décor et la ligne d'arrivée.
   Un « autopilote » joue la course : s'il trébuche, le jeu est injuste.
   Lancer :  node test/sim.js
   ============================================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');

// ----------------------------------------------------------------- bouchons
function makeElement(id) {
  return {
    id,
    textContent: '',
    hidden: false,
    clientWidth: 900,
    style: {},
    className: '',
    children: [],
    dataset: {},
    classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; },
    },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    get firstChild() { return this.children[0] || null; },
    querySelector(sel) { return (this._q = this._q || {})[sel] || (this._q[sel] = makeElement('q')); },
    querySelectorAll() { return []; },
    addEventListener() {},
    setAttribute() {},
    getContext() { return makeCtx(); },
  };
}

// contexte 2D factice : toute méthode renvoie un objet enchaînable
function makeCtx() {
  const chain = new Proxy(function () {}, {
    get(t, k) {
      if (k === 'width') return 40;
      return chain;
    },
    apply() { return chain; },
    set() { return true; },
  });
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => chain;
      if (k === 'measureText') return () => chain;
      if (k in t) return t[k];
      return chain;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

global.window = global;
global.document = {
  getElementById: (id) => (global.__els[id] = global.__els[id] || makeElement(id)),
  createElement: (tag) => makeElement('<' + tag + '>'),
  createTextNode: (txt) => ({ nodeType: 3, textContent: txt }),
  querySelectorAll: () => [],
  addEventListener() {},
  hidden: false,
  documentElement: {},
  fullscreenElement: null,
  body: null,
};
global.document.body = makeElement('body');
global.__els = {};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.requestAnimationFrame = () => 0;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.devicePixelRatio = 1;
global.innerWidth = 1280;
global.innerHeight = 800;
global.location = { hash: '', href: 'http://test/' };
// Node expose déjà `navigator` en lecture seule : on n'y touche pas.

// --------------------------------------------------------------- chargement
['data.js', 'dom.js', 'audio.js', 'draw.js', 'world.js', 'scene.js', 'race.js', 'dressing.js', 'main.js'].forEach((f) => {
  const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  vm.runInThisContext(code, { filename: 'js/' + f });
});

const CF = global.CF;
assert.ok(CF && CF.Race, 'CF.Race doit exister');

// ------------------------------------------------------------------ helpers
function newRace(charId, outfit, seedZones) {
  const canvas = makeElement('game');
  const race = new CF.Race(canvas, {});
  race.resize(CF.viewMetrics(1280, 800));
  race.setup(charId, outfit, [CF.randomOutfit(), CF.randomOutfit(), CF.randomOutfit()]);
  if (seedZones) {
    race.zones = seedZones.map((id) => CF.ZONES[id]);
    race.zoneLen = (CF.COURSE.meters * CF.COURSE.pxPerMeter) / race.zones.length;
    race.zoneIndex = -1;
    race.setZone(0, true);
  }
  return race;
}

// Autopilote : saute au bon moment pour les obstacles au sol, reste au sol
// pour les obstacles volants. Deux styles testés : le « tapotement » très court
// (ce que font la plupart des enfants) et l'appui maintenu.
function makeAutopilot(holdTime) {
  let heldUntil = -1;
  return function (race, now) {
    if (heldUntil >= 0 && now >= heldUntil) { race.release(); heldUntil = -1; }
    if (race.countdown > 0) return;
    const jm = race.jumpMetrics();
    // distance de déclenchement : environ un tiers de la portée de saut
    const trigger = Math.max(60, jm.reach * 0.34);
    let nearest = null;
    let nearestD = Infinity;
    for (const e of race.entities) {
      if (e.kind !== 'obs' || e.dead) continue;
      const d = e.x - race.dist;      // distance depuis le joueur (x = playerX)
      if (d > -20 && d < nearestD) { nearestD = d; nearest = e; }
    }
    if (nearest && !nearest.air && race.onGround && heldUntil < 0 &&
        nearestD < trigger + nearest.w * 0.2) {
      race.press();
      heldUntil = now + (holdTime || 0);
    }
  };
}

const AUTO_TAP = makeAutopilot(0);        // relâche immédiatement
const AUTO_HOLD = makeAutopilot(0.22);    // maintient 220 ms

function run(race, maxSeconds, pilot) {
  const dt = 1 / 60;
  let steps = 0;
  const limit = Math.ceil(maxSeconds / dt);
  while (steps < limit && !race.finished) {
    if (pilot) pilot(race, steps * dt);
    race.update(dt);
    steps++;
  }
  if (pilot) pilot(race, steps * dt);   // relâche l'appui en cours
  return steps * dt;
}

// ------------------------------------------------- 1. toutes les zones jouables
console.log('— Simulation : une course par décor, avec autopilote');
const report = [];
let allFinished = true;

for (const zid of CF.ZONE_ORDER) {
  const zones = [zid, zid, zid, zid];       // toute la course dans un seul décor
  for (const [label, pilot] of [['tap', AUTO_TAP], ['appui', AUTO_HOLD]]) {
    const race = newRace('momo', {}, zones);
    const elapsed = run(race, 200, pilot);
    const res = race.result;
    assert.ok(res, `la course doit se terminer (${zid}/${label})`);
    allFinished = allFinished && race.finished;
    report.push({
      decor: zid,
      style: label,
      fini: race.finished,
      temps: +elapsed.toFixed(1),
      chutes: res.bumps,
      bonbons: res.candies,
      place: res.rank + 1,
      obstacles: race.spawnCount,
    });
    assert.ok(race.spawnCount >= 18, `${zid}: seulement ${race.spawnCount} obstacles sur 600 m — trop peu`);
    assert.ok(res.bumps <= 4, `${zid}/${label}: ${res.bumps} chutes avec l'autopilote — parcours injuste`);
  }
}
console.table(report);
assert.ok(allFinished, 'toutes les courses doivent atteindre l’arrivée');

// ------------------------------------------- 2. équité des espacements
console.log('\n— Vérification : chaque obstacle est sautable');
let worst = Infinity;
let worstZone = '';
let pairs = 0;
for (const zid of CF.ZONE_ORDER) {
  for (const charId of CF.CHARACTER_ORDER) {
    const race = newRace(charId, {}, [zid, zid, zid, zid]);
    run(race, 40, false);          // on laisse défiler sans jouer
    const jm = race.jumpMetrics();
    const obs = race.entities
      .filter((e) => e.kind === 'obs')
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < obs.length; i++) {
      const gap = obs[i].x - (obs[i - 1].x + obs[i - 1].w);
      const need = obs[i].air ? jm.reach * 1.2 : jm.reach * 0.72;
      const ratio = gap / need;
      pairs++;
      if (ratio < worst) { worst = ratio; worstZone = `${zid}/${charId}`; }
      assert.ok(
        ratio > 0.85,
        `${zid}/${charId}: écart trop court (${Math.round(gap)}px pour ${Math.round(need)}px nécessaires)`
      );
    }
  }
}
console.log(`   ${pairs} paires d'obstacles vérifiées`);
assert.ok(pairs > 100, `seulement ${pairs} paires vérifiées : le test ne couvre rien`);
console.log(`   pire rapport écart/besoin = ${worst.toFixed(2)} (${worstZone}) — doit être > 0.85`);
assert.ok(worst < Infinity, 'aucune paire mesurée');

// ------------------------------------------------- 3. tenues : rien ne casse
console.log('\n— Vérification : toutes les tenues terminent la course');
const clothesIds = Object.keys(CF.CLOTHES);
for (const charId of CF.CHARACTER_ORDER) {
  for (const cid of clothesIds) {
    const item = CF.CLOTHES[cid];
    const outfit = { tete: null, torse: null, pieds: null, main: null };
    outfit[item.slot] = cid;
    const race = newRace(charId, outfit);
    const elapsed = run(race, 220, AUTO_TAP);
    assert.ok(race.finished, `${charId} + ${cid} : course non terminée (${elapsed.toFixed(0)}s)`);
    assert.ok(race.result.bumps <= 12, `${charId} + ${cid} : ${race.result.bumps} chutes — tenue injouable`);
    const st = race.stats;
    assert.ok(st.speed >= 0.7 && st.speed <= 1.5, `${charId}+${cid}: vitesse hors bornes`);
    assert.ok(st.gravity >= 0.4 && st.gravity <= 1.4, `${charId}+${cid}: gravité hors bornes`);
  }
  // tenue complète au hasard
  for (let k = 0; k < 6; k++) {
    const race = newRace(charId, CF.randomOutfit());
    run(race, 220, AUTO_TAP);
    assert.ok(race.finished, `${charId} tenue aléatoire : course non terminée`);
  }
}
console.log(`   ${CF.CHARACTER_ORDER.length} personnages × ${clothesIds.length} vêtements + tenues aléatoires : OK`);

// ------------------------------------------ 4. talents et pouvoirs vérifiés
console.log('\n— Vérification : les pouvoirs des vêtements ont bien un effet');
const base = CF.buildStats('momo', {});
const withHelice = CF.buildStats('momo', { tete: 'helice' });
assert.ok(withHelice.doubleJump, 'le casque à hélice doit donner le double saut');
assert.ok(!base.doubleJump, 'sans équipement, pas de double saut');

const withCape = CF.buildStats('momo', { torse: 'cape' });
assert.ok(withCape.gravity < base.gravity, 'la cape doit alléger la chute');

const withJetpack = CF.buildStats('momo', { main: 'jetpack' });
assert.ok(withJetpack.speed > base.speed, 'le jetpack doit accélérer');

const alu = CF.buildStats('momo', { torse: 'alu' });
assert.ok(alu.shield >= 1, "l'armure en alu doit donner un bouclier");

const bottes = CF.buildStats('momo', { pieds: 'bottes' });
assert.ok(bottes.bounce, 'les bottes géantes doivent faire rebondir');

const epuisette = CF.buildStats('patate', { main: 'epuisette' });
assert.ok(epuisette.magnet > base.magnet * 2, "l'épuisette doit aimanter les bonbons");

for (const charId of CF.CHARACTER_ORDER) {
  const s = CF.buildStats(charId, {});
  const t = CF.CHARACTERS[charId].talent.id;
  if (t === 'stomp') assert.ok(s.stomp > 0, 'Bébert doit écraser les obstacles');
  if (t === 'flap') assert.ok(s.flap > 0, 'Kiki doit battre des ailes');
  if (t === 'magnet') assert.ok(s.magnet > base.magnet, 'Prof. Patate doit aimanter');
}
console.log('   double saut, cape, jetpack, bouclier, rebond, aimant, talents : OK');

// ------------------------------------------------ 5. mécanique de course
console.log('\n— Vérification : boost, bouclier et décors se déclenchent');
{
  const race = newRace('momo', {});
  race.countdown = 0;
  race.candies = CF.COURSE.boostCandies - 1;
  race.collect({ got: false }, race.playerX, race.groundY - 40);
  assert.ok(race.boostT > 0, '10 bonbons doivent déclencher la super vitesse');

  const shielded = newRace('momo', { torse: 'alu' });
  shielded.countdown = 0;
  const bumpsBefore = shielded.bumps;
  shielded.bump({ w: 40, h: 40, x: 0 }, shielded.playerX);
  assert.strictEqual(shielded.bumps, bumpsBefore, 'le bouclier doit absorber le premier choc');
  assert.strictEqual(shielded.shield, 0, 'le bouclier doit se consommer');
  shielded.bump({ w: 40, h: 40, x: 0 }, shielded.playerX);
  assert.strictEqual(shielded.bumps, bumpsBefore + 1, 'sans bouclier on trébuche');

  // les 4 décors défilent bien pendant une course normale
  const trip = newRace('kiki', CF.randomOutfit());
  const seen = new Set();
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 200 && !trip.finished; i++) {
    AUTO_TAP(trip, i * dt);
    trip.update(dt);
    seen.add(trip.zone.id);
  }
  assert.strictEqual(seen.size, CF.COURSE.zoneCount, `4 décors attendus, ${seen.size} vus`);
  console.log(`   décors traversés : ${[...seen].join(' → ')}`);
}

// ---------------------------------------------------------- 6. hauteur de saut
console.log('\n— Vérification : la hauteur de saut permet de passer les obstacles');
for (const zid of CF.ZONE_ORDER) {
  const z = CF.ZONES[zid];
  const tallest = Math.max(...Object.values(z.obstacles).filter((o) => o.ground).map((o) => o.h));
  for (const charId of CF.CHARACTER_ORDER) {
    const race = newRace(charId, {}, [zid, zid, zid, zid]);
    const jm = race.jumpMetrics();
    assert.ok(
      jm.height > tallest + 24,
      `${zid}/${charId}: saut de ${jm.height.toFixed(0)}px insuffisant pour ${tallest}px`
    );
  }
}
console.log('   tous les personnages passent l’obstacle le plus haut de chaque décor');

// ------------------------------------- 7. flux complet dans un « navigateur »
console.log('\n— Vérification : démarrage → course → écran de résultats (DOM inclus)');
{
  CF.boot();                                   // comme au chargement de la page
  CF.debug.startRace();                        // bouton « C'EST PARTI ! »
  const race = CF.debug.race;
  assert.ok(race, 'la course doit être créée');
  assert.strictEqual(CF.debug.screen, 'race', 'on doit être sur l’écran de course');

  const dt = 1 / 60;
  let t = 0;
  while (t < 240 && !race.finished) { AUTO_TAP(race, t); race.update(dt); t += dt; }
  assert.ok(race.finished, 'la course doit se terminer');
  // laisse jouer l'animation de fin, comme le fait la boucle du jeu
  let guard = 0;
  while (!race.afterFinish(dt) && guard++ < 600) { /* célébration */ }
  CF.debug.showResults();                      // passage à l'écran de résultats
  assert.strictEqual(CF.debug.screen, 'results', 'on doit arriver sur les résultats');

  const rows = global.__els['uiRanking'].children;
  assert.strictEqual(rows.length, 4, 'le classement doit lister les 4 coureurs');
  const chips = global.__els['uiRaceStats'].children;
  assert.strictEqual(chips.length, 4, 'les 4 statistiques de course doivent s’afficher');
  const title = global.__els['uiResultTitle'].textContent;
  assert.ok(title.length > 3, 'le titre du résultat doit être rempli');
  assert.ok(race.result.bestAir > 0 && race.result.bestAir < 3,
    `« plus long saut » incohérent : ${race.result.bestAir.toFixed(1)} s`);
  console.log(`   résultat affiché : « ${title} » — ${rows.length} coureurs classés, plus long saut ${race.result.bestAir.toFixed(2)} s`);

  // et on peut relancer une partie depuis les résultats
  CF.debug.startRace();
  assert.strictEqual(CF.debug.screen, 'race', 'REJOUER doit relancer une course');
  assert.ok(!CF.debug.race.finished, 'la nouvelle course repart de zéro');
}

console.log('\n✅ Tous les tests passent.');
