/* ============================================================================
   SCÈNE — le décor qui défile en arrière-plan des menus (mode « attract »),
   et les utilitaires de caméra partagés avec la course.
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  var W = CF.world;

  // Dimensionne le monde virtuel : hauteur de référence 540, largeur adaptée à
  // l'écran. En portrait on garde assez de largeur pour VOIR ARRIVER les
  // obstacles (au moins ~1,2 s d'anticipation), quitte à montrer plus de ciel.
  CF.viewMetrics = function (cssW, cssH) {
    var aspect = cssW / Math.max(1, cssH);
    var H = 540, w = H * aspect;
    if (w < 600) { w = 600; H = w / aspect; }
    if (H > 900) { H = 900; w = Math.max(600, H * aspect); }
    return { W: w, H: H, scale: cssW / w };
  };

  CF.groundY = function (H) {
    return H - Math.min(200, Math.max(86, H * 0.2));
  };

  // ------------------------------------------------------------------ attract
  function Attract(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.camX = 0;
    this.zones = CF.pickZones();
    this.zi = 0;
    this.zoneT = 0;
    this.runners = CF.CHARACTER_ORDER.map(function (id, i) {
      return {
        id: id,
        outfit: CF.randomOutfit(),
        x: 0.18 + i * 0.16,      // position relative à la largeur
        bob: i * 1.7,
        speed: 0.94 + (i % 3) * 0.05,
        scale: 0.78 - i * 0.02,
      };
    });
    this.active = false;
  }

  Attract.prototype.zone = function () { return CF.ZONES[this.zones[this.zi % this.zones.length]]; };

  Attract.prototype.resize = function (vm) { this.vm = vm; };

  Attract.prototype.update = function (dt) {
    this.t += dt;
    this.zoneT += dt;
    if (this.zoneT > 12) { this.zoneT = 0; this.zi++; }
    this.camX += dt * 150;
  };

  Attract.prototype.draw = function () {
    var vm = this.vm;
    if (!vm) return;
    var ctx = this.ctx, W_ = vm.W, H = vm.H;
    var gy = CF.groundY(H);
    var z = this.zone();
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(vm.scale * (window.devicePixelRatio || 1), vm.scale * (window.devicePixelRatio || 1));

    W.sky(ctx, z, W_, H, this.t);
    W.far(ctx, z, W_, gy, this.camX, this.t);
    W.mid(ctx, z, W_, gy, this.camX, this.t);
    W.ground(ctx, z, W_, H, gy, this.camX);

    // les quatre copains courent en arrière-plan
    for (var i = 0; i < this.runners.length; i++) {
      var r = this.runners[i];
      var x = ((r.x * W_ + this.t * 40 * r.speed) % (W_ + 200)) - 100;
      var y = gy + 6 - i * 3;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.95;
      var pose = CF.draw.defaultPose();
      pose.phase = this.t * 11 * r.speed + r.bob;
      pose.t = this.t + r.bob;
      pose.air = Math.max(0, Math.sin(pose.phase)) > 0.94 ? 0.6 : 0;
      pose.onGround = !pose.air;
      ctx.scale(0.5, 0.5);
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.beginPath(); ctx.ellipse(0, 2, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.scale(r.scale * 2, r.scale * 2);
      CF.draw.runner(ctx, r.id, r.outfit, pose, 1);
      ctx.restore();
    }

    W.front(ctx, z, W_, H, gy, this.camX, this.t);
    W.overlay(ctx, z, W_, H, this.t);

    // léger voile pour que les menus restent lisibles
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(0, 0, W_, H);
    ctx.restore();
  };

  Attract.prototype.setOutfit = function (charId, outfit) {
    for (var i = 0; i < this.runners.length; i++) {
      if (this.runners[i].id === charId) this.runners[i].outfit = outfit;
    }
  };

  CF.Attract = Attract;
})(window.CF);
