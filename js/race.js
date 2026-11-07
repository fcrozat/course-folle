/* ============================================================================
   RACE — le jeu : physique du saut, obstacles, bonbons, rivaux, arrivée.
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  var G = CF.gfx, Wr = CF.world;
  var clamp = G.clamp, hash = G.hash, lerp = G.lerp, fill = G.fill, rr = G.rr, star = G.star, capsule = G.capsule, TAU = G.TAU;

  var M = CF.COURSE;
  var PX = M.pxPerMeter;

  // réglages de saut (en unités monde, g de base = 2500 px/s²)
  // Un appui COURT doit déjà suffire à passer le plus grand obstacle : les
  // enfants tapotent vite au lieu de maintenir appuyé.
  var JUMP_V = 1080;
  var GRAV = 2500;
  var RUN_PHASE = 13;          // cadence des jambes (rad/s)
  var STUMBLE_TIME = 0.95;     // durée d'un trébuchement
  var MAX_SPEED = 900;
  var AIR_Y = 130;             // hauteur du bas des obstacles volants (on passe dessous en courant)

  var KIND = ['🥇', '🥈', '🥉', '4ᵉ'];

  function Race(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onFinish = (opts && opts.onFinish) || function () {};
    this.onPauseRequest = (opts && opts.onPauseRequest) || function () {};
    this.vm = { W: 960, H: 540, scale: 1 };
    this.running = false;
    this.finished = false;
    this.paused = false;
    this.time = 0;
    this.particles = [];
    this.floats = [];
    this.shake = 0;
    this.toastUntil = 0;
    this.countdown = 0;
    this.wipe = -1;
    this.markersReady = false;
    this.ui = {};
  }

  // ------------------------------------------------------------------ préparation
  Race.prototype.setup = function (charId, outfit, rivalOutfits) {
    this.stats = CF.buildStats(charId, outfit);
    this.charId = charId;
    this.outfit = outfit;

    // tirage des décors et des positions de changement
    this.zones = CF.pickZones().map(function (id) { return CF.ZONES[id]; });
    this.zoneLen = (M.meters * PX) / this.zones.length;
    this.zoneIndex = -1;
    this.zone = this.zones[0];

    this.dist = 0;               // px parcourus
    this.speed = M.baseSpeed;
    this.y = 0;                  // hauteur au-dessus du sol (positif = en l'air)
    this.vy = 0;
    this.onGround = true;
    this.jumpsLeft = 1;
    this.holding = false;
    this.flapLeft = 0;
    this.phase = 0;
    this.squash = 0;
    this.stumble = 0;
    this.hurtT = 0;
    this.candies = 0;
    this.candyCount = 0;         // total ramassé (pour le résultat)
    this.shield = this.stats.shield > 0 ? 1 : 0;
    this.shieldCharge = 0;
    this.boostT = 0;
    this.bumps = 0;
    this.bestAir = 0;
    this.airStart = 0;
    this.finished = false;
    this.running = true;
    this.paused = false;
    this.time = 0;
    this.particles.length = 0;
    this.floats.length = 0;
    this.entities = [];
    this.nextX = this.vm.W * 1.1;
    this.spawnCount = 0;
    this.lastAirX = -1e9;
    this.lastGroundX = -1e9;
    this.wipe = -1;
    this.markersReady = false;
    this.countdown = 3.2;

    // rivaux : les trois autres personnages, habillés n'importe comment
    var ids = CF.CHARACTER_ORDER.filter(function (i) { return i !== charId; });
    this.rivals = ids.map(function (id, i) {
      var ro = (rivalOutfits && rivalOutfits[i]) || CF.randomOutfit();
      var rs = CF.buildStats(id, ro);
      return {
        id: id, char: CF.CHARACTERS[id], outfit: ro,
        stats: rs,
        speed: M.baseSpeed * rs.speed,
        dist: 0,
        phase: i * 2.1,
        surgeT: 1.5 + i * 2,
        surge: 0,
        stumble: 0,
        rubber: 1,
        finished: false,
        place: 0,
      };
    });
    // le joueur
    this.me = {
      id: charId, char: this.stats.char, outfit: outfit, stats: this.stats,
      dist: 0, place: 0, finished: false,
    };
    this.racers = this.rivals.concat([this.me]);

    this.setZone(0, true);
    this.buildHUD();
    return this;
  };

  Race.prototype.resize = function (vm) {
    this.vm = vm;
    this.groundY = CF.groundY(vm.H);
    this.playerX = vm.W * 0.28;
  };

  // ------------------------------------------------------------------- décors
  Race.prototype.setZone = function (i, silent) {
    i = clamp(i, 0, this.zones.length - 1);
    if (i === this.zoneIndex) return;
    this.zoneIndex = i;
    this.zone = this.zones[i];
    if (!silent) {
      this.wipe = 0;
      this.toast(this.zone.icon + ' ' + this.zone.message, 2.4);
      CF.Audio.play('zone');
    }
    var z = document.getElementById('uiZone');
    if (z) z.textContent = this.zone.icon + ' ' + this.zone.name;
  };

  // --------------------------------------------------------------------- HUD
  Race.prototype.buildHUD = function () {
    var self = this;
    ['uiCandies', 'uiBoost', 'uiDist', 'uiZone', 'uiToast', 'uiHint'].forEach(function (id) {
      self.ui[id] = document.getElementById(id);
    });
    this.ui.track = document.getElementById('track');
    // marqueurs : 3 rivaux + le joueur (mk3)
    this.markers = [0, 1, 2, 3].map(function (i) {
      var m = document.getElementById('mk' + i);
      var cv = m ? m.querySelector('canvas') : null;
      return { node: m, canvas: cv, drawn: false };
    });
    this._domReady = true;
    this.markersReady = false;
    if (this.ui.uiZone) this.ui.uiZone.textContent = this.zone.icon + ' ' + this.zone.name;
    if (this.ui.uiHint) this.ui.uiHint.classList.remove('gone');
  };

  Race.prototype.drawMarkers = function () {
    var self = this;
    // l'ordre des marqueurs : rivaux puis joueur
    this.racers.forEach(function (r, i) {
      var mk = self.markers[i];
      if (!mk || !mk.canvas || mk.drawn) return;
      var d = CF.dom.canvas2d(mk.canvas);
      CF.draw.face(d.ctx, r.id, d.w, r.outfit);
      mk.drawn = true;
      mk.node.classList.toggle('me', r === self.me);
      mk.node.title = CF.CHARACTERS[r.id].name;
    });
    this.markersReady = true;
  };

  Race.prototype.updateHUD = function () {
    var total = M.meters * PX;
    var pos = [];
    var self = this;
    this.racers.forEach(function (r, i) { pos.push({ i: i, d: clamp(r.dist, 0, total) }); });
    pos.sort(function (a, b) { return b.d - a.d; });
    pos.forEach(function (p, rank) { self.racers[p.i].place = rank; });

    if (this.markersReady && this.ui.track) {
      var w = this.ui.track.clientWidth || 300;
      this.racers.forEach(function (r, i) {
        var mk = self.markers[i];
        if (!mk || !mk.node) return;
        var x = clamp(r.dist / total, 0, 1) * (w - 40) + 20;
        mk.node.style.left = x + 'px';
        mk.node.classList.toggle('leader', r.place === 0);
      });
    }

    if (this.ui.uiDist) this.ui.uiDist.textContent = Math.floor(this.dist / PX);
    if (this.ui.uiCandies) this.ui.uiCandies.textContent = String(this.candies);
    if (this.ui.uiBoost) {
      var f = clamp(this.candies / M.boostCandies, 0, 1);
      this.ui.uiBoost.style.width = (f * 100).toFixed(1) + '%';
      this.ui.uiBoost.classList.toggle('full', f >= 1);
    }
    // l'astuce « appuie pour sauter » disparaît après quelques secondes
    if (this.ui.uiHint && this.time > 7 && !this.ui.uiHint.classList.contains('gone')) {
      this.ui.uiHint.classList.add('gone');
    }
  };

  Race.prototype.toast = function (text, dur, cls) {
    var t = this.ui.uiToast;
    if (!t) return;
    t.textContent = text;
    t.className = 'toast show' + (cls ? ' ' + cls : '');
    this.toastUntil = this.time + (dur || 1.6);
  };

  // ------------------------------------------------------------------ entrées
  Race.prototype.press = function () {
    if (!this.running || this.paused) return;
    this.holding = true;
    if (this.countdown > 0) return;   // avant le top départ, on s'échauffe
    this.tryJump();
  };

  Race.prototype.release = function () {
    this.holding = false;
    // saut à hauteur variable : relâcher tôt donne un saut un peu plus bas,
    // mais jamais trop bas pour passer un obstacle (coupe volontairement douce)
    if (this.vy > 300) this.vy *= 0.86;
    this.flapLeft = 0;
  };

  Race.prototype.tryJump = function () {
    if (this.stumble > 0) return;
    if (this.onGround) {
      this.vy = JUMP_V * this.stats.jump;
      this.onGround = false;
      this.jumpsLeft = this.stats.doubleJump ? 1 : 0;
      this.flapLeft = this.stats.flap || 0;
      this.airStart = this.time;
      this.squash = -0.4;   // étirement au décollage
      CF.Audio.play('jump', this.stats.jump - 0.9);
      this.puff(this.playerX, this.groundY, 8, '#ffffff');
    } else if (this.jumpsLeft > 0) {
      this.jumpsLeft--;
      this.vy = JUMP_V * this.stats.jump * 0.86;
      this.flapLeft = this.stats.flap || 0;
      this.squash = -0.3;
      CF.Audio.play('doubleJump');
      this.ring(this.playerX, this.groundY - this.y, '#ffe066');
      this.puff(this.playerX, this.groundY - this.y, 10, '#fff3bf');
    }
  };

  // ------------------------------------------------------------- génération
  // Vitesse « de croisière », sans trébuchement ni super-vitesse : c'est elle
  // qui sert à espacer les obstacles. Sinon un choc ralentit le joueur, la
  // portée de saut calculée devient trop petite, et les obstacles suivants
  // seraient générés trop serrés pour être passables une fois relancé.
  Race.prototype.nominalSpeed = function () {
    return Math.min(MAX_SPEED, M.baseSpeed * this.stats.speed * this.zone.speed);
  };

  Race.prototype.jumpMetrics = function () {
    var g = GRAV * this.stats.gravity * this.zone.gravity;
    var v = JUMP_V * this.stats.jump;
    var airTime = (2 * v) / g;
    return { airTime: airTime, height: (v * v) / (2 * g), reach: this.nominalSpeed() * airTime };
  };

  Race.prototype.spawn = function () {
    // bord droit de l'écran exprimé en coordonnées MONDE (les obstacles vivent
    // dans le monde, pas à l'écran) : x_monde = dist + x_écran - playerX
    var view = this.dist + this.vm.W - this.playerX;
    var jm = this.jumpMetrics();
    var guard = 0;
    while (this.nextX < view + 260 && guard++ < 12) {
      var x = this.nextX;
      if (x > this.finishX() - 260) break;      // on ne met rien près de l'arrivée

      var types = this.zoneTypes();
      var ground = types.filter(function (t) { return t.ground; });
      var type = types[Math.floor(Math.random() * types.length)];

      // équité : un obstacle volant a besoin de place avant et après, sinon on
      // le remplace par un obstacle au sol.
      if (!type.ground) {
        var tooSoon = x < PX * 110;
        var crowded = (x - this.lastAirX < jm.reach * 2.4) || (x - this.lastGroundX < jm.reach * 1.7);
        if (tooSoon || crowded || !ground.length) {
          type = ground[Math.floor(Math.random() * ground.length)] || type;
        }
      }
      var air = !type.ground;

      this.entities.push({
        kind: 'obs', type: type, art: type.art,
        x: x, w: type.w, h: type.h, air: air, dead: false, t: Math.random() * 6,
      });
      this.spawnCount++;
      if (air) this.lastAirX = x; else this.lastGroundX = x;

      // bonbons : parfois une ligne au sol, parfois une arche par-dessus l'obstacle
      var r = Math.random();
      if (r < 0.55 * this.zone.candyRate) {
        this.addCandyArc(x + type.w * 0.5, type.ground ? type.h : 40, jm.height);
      } else if (r < 0.8) {
        var cx = x + type.w + 90 + Math.random() * 140;
        var n = 3 + Math.floor(Math.random() * 3);
        // une petite ligne en hauteur : un saut (même petit) la ramasse
        for (var i = 0; i < n; i++) this.addCandy(cx + i * 46, 118 + Math.sin(i * 0.9) * 16, i);
      }

      // prochain espacement : toujours de quoi atterrir et repartir
      var extra = this.pickGap(type, jm);
      this.nextX = x + type.w + extra;
    }
  };

  Race.prototype.zoneTypes = function () {
    var z = this.zone;
    var keys = Object.keys(z.obstacles).filter(function (k) {
      return z.air || z.obstacles[k].ground;
    });
    return keys.map(function (k) {
      var o = z.obstacles[k];
      return { key: k, art: o.art, w: o.w, h: o.h, ground: o.ground };
    });
  };

  // distance libre après un obstacle (en px) — volontairement large : on vise
  // environ 2 à 3 secondes entre deux obstacles, lisible pour un enfant.
  Race.prototype.pickGap = function (type, jm) {
    var easy = this.dist < PX * 90;               // début de course plus calme
    var base = jm.reach * (easy ? 1.9 : 1.8);
    var span = easy ? 260 : 520;
    var g = base + span * (0.35 + Math.random() * 0.65);
    if (!type.ground) g += jm.reach * 0.6;         // après un obstacle volant, on respire
    return Math.max(240, Math.min(g, jm.reach * 3.2 + 520));
  };

  Race.prototype.addCandy = function (x, y, i) {
    this.entities.push({ kind: 'candy', x: x, y: y, r: 13, got: false, seed: (Math.floor(hash(x) * 3) + (i || 0)) % 3 });
  };

  Race.prototype.addCandyArc = function (cx, baseH, jumpH) {
    var n = 5;
    var spread = 190;
    // une arche AU-DESSUS de l'obstacle : il faut sauter pour l'attraper
    var base = Math.max(112, baseH) + 40;
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var y = base + Math.sin(t * Math.PI) * Math.min(150, jumpH * 0.7);
      this.addCandy(cx - spread / 2 + t * spread, y, i);
    }
  };

  Race.prototype.finishX = function () { return M.meters * PX; };

  // ------------------------------------------------------------------- boucle
  Race.prototype.update = function (dt) {
    if (!this.running || this.paused) return;
    this.time += dt;

    if (this.wipe >= 0) {
      this.wipe += dt * 1.9;
      if (this.wipe > 1) this.wipe = -1;
    }

    // compte à rebours
    if (this.countdown > 0) {
      var before = Math.ceil(this.countdown);
      this.countdown -= dt;
      var after = Math.ceil(this.countdown);
      if (after !== before) CF.Audio.play('count', after <= 0);
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.toast('PARTEZ !', 1.1, 'go');
      }
      this.updateAnim(dt, 0);
      this.updateParticles(dt);
      return;
    }

    // --- décor suivant ?
    var zi = Math.min(this.zones.length - 1, Math.floor(this.dist / this.zoneLen));
    if (zi !== this.zoneIndex) this.setZone(zi);

    // --- vitesse du joueur
    var target = M.baseSpeed * this.stats.speed * this.zone.speed;
    if (this.boostT > 0) { target *= 1.5; this.boostT -= dt; }
    if (this.stumble > 0) {
      this.stumble -= dt;
      target *= 0.30;
      if (this.stumble <= 0) this.stumble = 0;
    }
    target = Math.min(target, MAX_SPEED);
    this.speed += (target - this.speed) * Math.min(1, dt * (this.stumble > 0 ? 9 : 3.2));

    // --- saut / gravité
    var g = GRAV * this.stats.gravity * this.zone.gravity;
    if (!this.onGround) {
      // la poulette bat des ailes tant qu'on reste appuyé
      if (this.holding && this.vy > -40 && this.flapLeft > 0) {
        this.flapLeft -= dt;
        this.vy += 1450 * dt;
        if (Math.random() < dt * 12) this.puff(this.playerX - 10, this.groundY - this.y + 6, 3, '#ffffff');
      }
      // montée plus facile que la chute : c'est plus agréable à jouer
      var gg = this.vy > 0 ? g * 0.92 : g * 1.12;
      this.vy -= gg * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) this.land();
    } else {
      this.y = 0;
      this.vy = 0;
    }

    this.dist += this.speed * dt;
    this.me.dist = this.dist;          // le marqueur du joueur suit la course
    this.phase += dt * RUN_PHASE * (this.speed / M.baseSpeed) * (this.onGround ? 1 : 0.5);
    this.squash += (0 - this.squash) * Math.min(1, dt * 9);
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.2);
    if (this.toastUntil && this.time > this.toastUntil && this.ui.uiToast) {
      this.ui.uiToast.className = 'toast';
      this.toastUntil = 0;
    }

    this.updateAnim(dt, this.speed);
    this.updateRivals(dt);
    this.spawn();
    this.collide();
    this.updateParticles(dt);

    // --- arrivée
    var total = this.finishX();
    var someone = null;
    for (var i = 0; i < this.racers.length; i++) {
      var r = this.racers[i];
      if (!r.finished && r.dist >= total) { r.finished = true; someone = r; }
      if (r.dist > total) r.dist = total;
    }
    if (someone) this.finish(someone === this.me);
    this.updateHUD();
  };

  // animation commune (jambes, rivaux, poussières de course)
  Race.prototype.updateAnim = function (dt, speed) {
    this.rivals.forEach(function (r) {
      r.phase += dt * RUN_PHASE * (r.speed / M.baseSpeed);
    });
    if (speed > 10 && this.onGround && Math.random() < dt * 22) {
      this.puff(this.playerX - 18, this.groundY + 2, 2, 'rgba(255,255,255,.85)');
    }
    if (this.boostT > 0 && Math.random() < dt * 40) {
      this.puff(this.playerX - 26, this.groundY - this.y - 20 - Math.random() * 40, 2, Math.random() < 0.5 ? '#ffe066' : '#ff922b');
    }
  };

  Race.prototype.land = function () {
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.squash = 1;
    this.jumpsLeft = this.stats.doubleJump ? 1 : 0;
    this.flapLeft = 0;
    var air = this.time - this.airStart;
    if (air > this.bestAir) this.bestAir = air;
    CF.Audio.play('land');
    this.puff(this.playerX, this.groundY, 9, '#ffffff');

    // talent de Bébert : il écrase ce qui se trouve devant lui
    if (this.stats.stomp) {
      var self = this;
      var killed = 0;
      this.entities.forEach(function (e) {
        if (e.kind === 'obs' && !e.dead && e.type.ground) {
          var sx = e.x - self.dist + self.playerX;
          if (sx > -30 && sx < self.stats.stomp + 20) { e.dead = true; killed++; self.burst(sx, self.groundY - e.h * 0.4, '#ffd43b'); }
        }
      });
      if (killed) {
        CF.Audio.play('stomp');
        this.shake = Math.min(1, this.shake + 0.35);
        this.toast('BOUM ! ' + (killed > 1 ? killed + ' obstacles écrasés !' : 'Obstacle écrasé !'), 1.0);
      }
    }
    // les bottes / le gilet canard font rebondir
    if (this.stats.bounce && this.stumble <= 0) {
      this.vy = JUMP_V * this.stats.jump * 0.5;
      this.onGround = false;
      this.airStart = this.time;
      this.squash = -0.35;
      CF.Audio.play('pop');
    }
  };

  // ------------------------------------------------------------------- rivaux
  Race.prototype.updateRivals = function (dt) {
    var self = this;
    var total = this.finishX();
    var myPct = this.dist / total;

    this.rivals.forEach(function (r) {
      // petits coups de pouce du destin pour que la course reste serrée
      r.surgeT -= dt;
      if (r.surgeT <= 0) {
        r.surgeT = 2.6 + Math.random() * 4.5;
        r.surge = Math.random() < 0.3 ? 0.18 : 0;
        if (Math.random() < 0.22) r.stumble = 0.5 + Math.random() * 0.5;
      }
      if (r.surge > 0) r.surge = Math.max(0, r.surge - dt * 0.09);
      if (r.stumble > 0) r.stumble -= dt;

      // élastique discret : personne ne s'envole, personne ne disparaît
      var gap = r.dist / total - myPct;
      r.rubber = 1 - clamp(gap * 1.1, -0.16, 0.17);

      var v = r.speed * r.rubber * (1 + r.surge) * (r.stumble > 0 ? 0.35 : 1) * self.zone.speed;
      r.dist += v * dt;
    });
  };

  // ---------------------------------------------------------------- collisions
  Race.prototype.hitbox = function () {
    var h = this.stats.char.species === 'potato' ? 78 : 106;
    var w = this.stats.char.species === 'elephant' ? 46 : 40;
    return { x: this.playerX - w / 2, y: this.groundY - this.y - h, w: w, h: h };
  };

  Race.prototype.collide = function () {
    var self = this;
    var hb = this.hitbox();
    // aimant : assez court pour que les bonbons hauts récompensent un vrai saut
    var magnet = 34 * this.stats.magnet;
    var boost = this.boostT > 0;

    this.entities.forEach(function (e) {
      var sx = e.x - self.dist + self.playerX;
      if (sx < -220 || sx > self.vm.W + 240) return;

      if (e.kind === 'candy') {
        if (e.got) return;
        var cy = self.groundY - e.y;
        var dx = sx - hb.x - hb.w / 2, dy = cy - (hb.y + hb.h / 2);
        var d2 = dx * dx + dy * dy;
        var rr2 = (magnet + e.r) * (magnet + e.r);
        if (d2 < 900) { self.collect(e, sx, cy); return; }
        if (d2 < rr2) {  // l'aimant attire le bonbon
          e.x += (hb.x + hb.w / 2 - sx) * 0.16;
          e.y += (hb.y + hb.h / 2 - cy) * -0.16;
        }
        return;
      }

      if (e.dead) return;
      // boîte de l'obstacle, un peu plus petite que le dessin : on pardonne
      var pad = 9;
      var base = e.air ? self.groundY - AIR_Y : self.groundY;
      var ox = sx + pad;
      var ow = Math.max(8, e.w - pad * 2);
      var oy = base - e.h + (e.air ? 6 : 5);
      var oh = e.h - (e.air ? 6 : 5);
      if (hb.x < ox + ow && hb.x + hb.w > ox && hb.y < oy + oh && hb.y + hb.h > oy) {
        if (boost) {
          e.dead = true;
          self.burst(sx + e.w / 2, oy + oh / 2, '#ffe066');
          CF.Audio.play('pop');
          self.float(sx, oy, '🎉 PAF !', '#ffd43b');
        } else {
          self.bump(e, sx);
        }
      }
    });

    // nettoyage de ce qui est loin derrière
    if (this.entities.length > 90) {
      this.entities = this.entities.filter(function (e) { return e.x > self.dist - 400; });
    }
  };

  Race.prototype.collect = function (e, sx, cy) {
    e.got = true;
    var val = Math.round(this.stats.candy);
    this.candies += val;
    this.candyCount += val;
    CF.Audio.play('candy', this.candyCount);
    this.burst(sx, cy, '#ff85a2', 8);
    this.float(sx, cy, '+' + val, '#ff5d8f');

    if (this.shield < 1 && this.stats.shield > 0) {
      this.shieldCharge += val;
      if (this.shieldCharge >= M.shieldCost) {
        this.shieldCharge = 0; this.shield = 1;
        this.toast('🛡️ Bouclier rechargé !', 1.3);
        CF.Audio.play('shield');
      }
    }

    if (this.candies >= M.boostCandies && this.boostT <= 0) {
      this.candies = 0;
      this.boostT = M.boostTime;
      this.shake = 0.5;
      this.toast('🚀 SUPER VITESSE !', 1.8, 'boost');
      CF.Audio.play('boost');
      this.ring(this.playerX, this.groundY - this.y - 50, '#ffe066');
    }
  };

  Race.prototype.bump = function (e, sx) {
    e.dead = true;
    if (this.shield > 0) {
      this.shield = 0;
      this.burst(sx + e.w / 2, this.groundY - e.h * 0.5, '#4dabf7', 14);
      this.toast('🛡️ Protégé !', 1.1);
      CF.Audio.play('shield');
      return;
    }
    if (this.stumble > 0) return;   // on ne retombe pas deux fois de suite
    this.bumps++;
    this.stumble = STUMBLE_TIME * (this.stats.char.talent.id === 'soft' ? 0.5 : 1);
    this.hurtT = this.stumble + 0.4;
    this.vy = Math.max(this.vy, 260);
    this.onGround = false;
    this.airStart = this.time;      // sinon le « plus long saut » partirait de t=0
    this.jumpsLeft = this.stats.doubleJump ? 1 : 0;
    this.shake = 1;
    this.speed *= 0.45;
    this.burst(sx + e.w / 2, this.groundY - e.h * 0.5, '#ff6b6b', 14);
    var msgs = ['AÏE !', 'OUPS !', 'PATATRA !', 'BOUM !'];
    this.toast(msgs[Math.floor(Math.random() * msgs.length)], 1.0, 'ouch');
    CF.Audio.play('bump');
  };

  // --------------------------------------------------------------- particules
  Race.prototype.puff = function (x, y, n, color) {
    for (var i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 6,
        vx: -40 - Math.random() * 90, vy: 20 + Math.random() * 70,
        life: 0.4 + Math.random() * 0.4, t: 0, r: 3 + Math.random() * 5,
        color: color || '#ffffff', kind: 'puff',
      });
    }
  };

  Race.prototype.burst = function (x, y, color, n) {
    n = n || 12;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = 90 + Math.random() * 220;
      this.particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: -Math.sin(a) * s - 40,
        life: 0.5 + Math.random() * 0.5, t: 0, r: 3 + Math.random() * 4,
        color: color, kind: 'spark',
      });
    }
  };

  Race.prototype.ring = function (x, y, color) {
    this.particles.push({ x: x, y: y, life: 0.45, t: 0, r: 10, color: color, kind: 'ring' });
  };

  Race.prototype.float = function (x, y, text, color) {
    this.floats.push({ x: x, y: y, text: text, color: color, t: 0, life: 1.0 });
  };

  Race.prototype.confetti = function (n) {
    for (var i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * this.vm.W, y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 90, vy: 90 + Math.random() * 160,
        life: 3.4, t: 0, r: 4 + Math.random() * 5, spin: Math.random() * TAU,
        color: ['#ffd43b', '#4dabf7', '#69db7c', '#ff85a2', '#b197fc'][i % 5], kind: 'confetti',
      });
    }
  };

  Race.prototype.updateParticles = function (dt) {
    var ps = this.particles;
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i];
      p.t += dt;
      if (p.t > p.life) { ps.splice(i, 1); continue; }
      if (p.kind === 'ring') { p.r += dt * 260; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind !== 'confetti') p.vy += 780 * dt;
      else { p.vy += 40 * dt; p.spin += dt * 6; p.x += Math.sin(p.t * 5) * 30 * dt; }
    }
    for (var f = this.floats.length - 1; f >= 0; f--) {
      var fl = this.floats[f];
      fl.t += dt;
      fl.y -= dt * 46;
      if (fl.t > fl.life) this.floats.splice(f, 1);
    }
  };

  // ------------------------------------------------------------------- arrivée
  Race.prototype.finish = function (playerWon) {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    // classement : distance parcourue, les finisseurs d'abord
    var order = this.racers.slice().sort(function (a, b) { return b.dist - a.dist; });
    var rank = order.indexOf(this.me);
    if (playerWon) {
      this.confetti(90);
      CF.Audio.play('win');
    } else {
      CF.Audio.play('lose');
    }
    var self = this;
    order.forEach(function (r, i) { r.place = i; });
    this.result = {
      rank: rank,
      won: playerWon,
      order: order.map(function (r) {
        return { id: r.id, name: CF.CHARACTERS[r.id].name, outfit: r.outfit || self.outfit, place: r.place };
      }),
      candies: this.candyCount,
      bumps: this.bumps,
      bestAir: this.bestAir,
      meters: Math.floor(this.dist / PX),
    };
    // petite seconde de fête avant l'écran de résultats
    this.celebrate = 1.5;
  };

  // -------------------------------------------------------------------- dessin
  Race.prototype.draw = function () {
    var vm = this.vm, ctx = this.ctx;
    var W = vm.W, H = vm.H, gy = this.groundY;
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * vm.scale, 0, 0, dpr * vm.scale, 0, 0);

    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 12 * this.shake, (Math.random() - 0.5) * 8 * this.shake);
    }

    var z = this.zone, t = this.time;
    var cam = this.dist;
    if (!this.markersReady) this.drawMarkers();

    Wr.sky(ctx, z, W, H, t);
    Wr.far(ctx, z, W, gy, cam, t);
    Wr.mid(ctx, z, W, gy, cam, t);
    Wr.ground(ctx, z, W, H, gy, cam);

    // ligne d'arrivée
    var fx = this.finishX() - cam + this.playerX;
    if (fx < W + 260 && fx > -200) Wr.finish(ctx, fx, gy, H, t);

    this.drawEntities(ctx, cam, gy, t);
    this.drawRivals(ctx, gy, t);
    this.drawPlayer(ctx, gy, t);
    this.drawParticles(ctx);

    Wr.front(ctx, z, W, H, gy, cam, t);
    Wr.overlay(ctx, z, W, H, t);

    if (this.wipe >= 0) Wr.wipe(ctx, W, H, this.wipe);
    if (this.boostT > 0) this.drawBoostFX(ctx, W, H);
    this.drawFloats(ctx);
    this.drawCountdown(ctx, W, H);
    if (this.celebrate) this.drawCelebrate(ctx, W, H);
  };

  Race.prototype.drawEntities = function (ctx, cam, gy, t) {
    // bonbons et obstacles, triés par position pour un rendu stable
    var list = this.entities;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var sx = e.x - cam + this.playerX;
      if (sx < -260 || sx > this.vm.W + 260) continue;
      if (e.kind === 'candy') {
        if (e.got) continue;
        Wr.candy(ctx, sx, gy - e.y, e.r, t, e.seed);
      } else if (!e.dead) {
        var baseY = e.air ? gy - AIR_Y : gy;
        Wr.obstacle(ctx, { x: sx, y: baseY, w: e.w, h: e.h, art: e.art }, t + e.t);
        // ombre au sol : aide à voir où l'obstacle se trouve
        ctx.globalAlpha = e.air ? 0.1 : 0.18;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(sx + e.w / 2, gy + 4, e.w * (e.air ? 0.34 : 0.55), e.air ? 5 : 7, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  };

  Race.prototype.drawRivals = function (ctx, gy, t) {
    var self = this;
    var list = this.rivals.slice().sort(function (a, b) { return a.dist - b.dist; });
    list.forEach(function (r) {
      var dxm = (r.dist - self.dist) / PX;            // mètres d'écart
      if (Math.abs(dxm) > 62) return;                  // trop loin pour être vu
      // compression : les écarts lointains restent visibles à l'écran
      var px = dxm * PX * (Math.abs(dxm) < 6 ? 1 : 0.22);
      var x = self.playerX + px;
      var sc = clamp(0.62 - Math.abs(dxm) * 0.002, 0.5, 0.66);
      var y = gy + 4 - (1 - sc) * 26;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = clamp(1.15 - Math.abs(dxm) * 0.012, 0.45, 1);
      ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(0, 2, 32, 8, 0, 0, TAU); ctx.fill();
      var pose = CF.draw.defaultPose();
      pose.phase = r.phase; pose.t = t; pose.speed = 1;
      pose.air = r.stumble > 0 ? 0.2 : 0;
      pose.onGround = !pose.air;
      pose.stumble = r.stumble > 0 ? r.stumble : 0;
      pose.hurt = r.stumble > 0;
      pose.lean = -0.05;
      CF.draw.runner(ctx, r.id, r.outfit, pose, 1);
      ctx.restore();
      // bulle de position au-dessus du rival
      if (Math.abs(dxm) < 45) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.font = 'bold 15px "Trebuchet MS", system-ui, sans-serif';
        ctx.textAlign = 'center';
        var label = dxm > 0 ? '+' + Math.round(dxm) + ' m' : Math.round(dxm) + ' m';
        var tw = ctx.measureText(label).width;
        rr(ctx, x - tw / 2 - 8, y - 150 * sc, tw + 16, 22, 11);
        ctx.fillStyle = dxm > 0 ? 'rgba(255,93,143,.92)' : 'rgba(64,192,87,.92)';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, y - 150 * sc + 16);
        ctx.restore();
        ctx.textAlign = 'left';
      }
    });
  };

  Race.prototype.drawPlayer = function (ctx, gy, t) {
    var pose = CF.draw.defaultPose();
    pose.phase = this.phase;
    pose.t = t;
    pose.air = this.onGround ? 0 : 1;
    pose.onGround = this.onGround;
    pose.vy = this.vy;
    pose.squash = this.squash;
    pose.stumble = this.stumble > 0 ? clamp(this.stumble, 0, 1) : 0;
    pose.hurt = this.hurtT > 0;
    pose.lean = this.stumble > 0 ? 0.25 : -0.05 - clamp((this.speed - M.baseSpeed) / M.baseSpeed, -0.3, 0.6) * 0.12;
    pose.speed = this.speed / M.baseSpeed;
    pose.boost = this.boostT > 0;
    pose.flap = (this.holding && !this.onGround && this.flapLeft > 0) ? 1 : 0;

    var x = this.playerX, y = gy - this.y;

    // ombre : plus petite et plus claire quand on s'envole
    var k = clamp(1 - this.y / 420, 0.25, 1);
    ctx.globalAlpha = 0.22 * k;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, gy + 4, 34 * k, 9 * k, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    // halo de bouclier
    if (this.shield > 0) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.12;
      ctx.strokeStyle = '#4dabf7'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(x, y - 52, 52, 66, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.boostT > 0) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.ellipse(x, y - 52, 58, 72, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(x, y);
    CF.draw.runner(ctx, this.charId, this.outfit, pose, 1);
    ctx.restore();
  };

  Race.prototype.drawParticles = function (ctx) {
    this.particles.forEach(function (p) {
      var a = 1 - p.t / p.life;
      ctx.globalAlpha = clamp(a, 0, 1);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 5 * a;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
      } else if (p.kind === 'confetti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
        ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        ctx.restore();
      } else if (p.kind === 'spark') {
        star(ctx, p.x, p.y, p.r * (0.6 + a * 0.6), 4, 0.4);
        ctx.fillStyle = p.color; ctx.fill();
      } else {
        fill(ctx, p.color, p.x, p.y, p.r * (0.5 + a * 0.8), p.r * (0.5 + a * 0.8));
      }
    });
    ctx.globalAlpha = 1;
  };

  Race.prototype.drawFloats = function (ctx) {
    ctx.textAlign = 'center';
    this.floats.forEach(function (f) {
      var a = 1 - f.t / f.life;
      ctx.globalAlpha = clamp(a * 1.4, 0, 1);
      ctx.font = 'bold 22px "Trebuchet MS", system-ui, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  };

  Race.prototype.drawBoostFX = function (ctx, W, H) {
    var k = clamp(this.boostT / M.boostTime, 0, 1);
    ctx.globalAlpha = 0.25 * k;
    var g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(255,220,80,0)');
    g.addColorStop(1, 'rgba(255,140,60,.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 3;
    for (var i = 0; i < 12; i++) {
      var y = hash(i * 2.3 + Math.floor(this.time * 8)) * H;
      var len = 60 + hash(i * 5.1) * 160;
      var x = W - ((this.time * 1400 + i * 190) % (W + 400));
      capsule(ctx, x, y, x + len, y, 3, 'rgba(255,255,255,.5)');
    }
  };

  Race.prototype.drawCountdown = function (ctx, W, H) {
    if (this.countdown <= 0) return;
    var n = Math.min(3, Math.ceil(this.countdown));   // jamais de « 4 » affiché
    var frac = this.countdown - Math.floor(this.countdown);
    var s = 1 + (1 - frac) * 0.5;
    ctx.save();
    ctx.translate(W / 2, H * 0.36);
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(frac * 1.6, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = 'bold 96px "Trebuchet MS", system-ui, sans-serif';
    ctx.lineWidth = 16; ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 6;
    ctx.strokeText(String(n), 0, 0);
    ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffd43b';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  };

  Race.prototype.drawCelebrate = function (ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = clamp(this.celebrate, 0, 1) * 0.9;
    ctx.textAlign = 'center';
    ctx.font = 'bold 62px "Trebuchet MS", system-ui, sans-serif';
    var txt = this.result && this.result.rank === 0 ? 'VICTOIRE !' : 'ARRIVÉE !';
    ctx.lineWidth = 14; ctx.strokeStyle = '#fff';
    ctx.strokeText(txt, W / 2, H * 0.32);
    ctx.fillStyle = this.result && this.result.rank === 0 ? '#ffd43b' : '#4dabf7';
    ctx.fillText(txt, W / 2, H * 0.32);
    ctx.restore();
    ctx.textAlign = 'left';
  };

  // ------------------------------------------------------------- pause / arrêt
  Race.prototype.pause = function () { if (this.running) { this.paused = true; this.holding = false; } };
  Race.prototype.resume = function () { this.paused = false; };
  Race.prototype.stop = function () { this.running = false; this.paused = false; };

  // Laisse jouer l'animation de fin avant d'afficher les résultats.
  Race.prototype.afterFinish = function (dt) {
    if (!this.finished) return false;
    this.time += dt;
    this.updateParticles(dt);
    this.phase += dt * RUN_PHASE;
    if (this.celebrate > 0) {
      this.celebrate -= dt;
      if (this.celebrate <= 0) { this.celebrate = 0; return true; }
    }
    return false;
  };

  CF.Race = Race;
  CF.RACE_KIND = KIND;
})(window.CF);
