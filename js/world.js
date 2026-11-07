/* ============================================================================
   MONDE — décors (ciel, sol, plantes), obstacles et bonbons.
   Convention : les obstacles sont dessinés avec (0,0) = coin bas-gauche.
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  var G = CF.gfx;
  var rr = G.rr, ell = G.ell, fill = G.fill, capsule = G.capsule, bend = G.bend, star = G.star, hash = G.hash, shade = G.shade, TAU = G.TAU;

  CF.world = {};

  // -------------------------------------------------------------------- ciel
  CF.world.sky = function (ctx, z, W, H, t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, z.sky[0]);
    g.addColorStop(1, z.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // étoiles (zone lune)
    if (z.stars) {
      for (var i = 0; i < 60; i++) {
        var x = hash(i) * W, y = hash(i + 99) * H * 0.7;
        var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
        ctx.globalAlpha = tw * 0.9;
        fill(ctx, '#fff', x, y, hash(i + 7) * 1.8 + 0.8, hash(i + 7) * 1.8 + 0.8);
      }
      ctx.globalAlpha = 1;
    } else {
      // nuages / bulles de fond
      for (var c = 0; c < 5; c++) {
        var cx = ((hash(c * 3.1) * W * 2) - (t * (8 + c * 4)) % (W * 2) + W * 2) % (W * 2) - W * 0.5;
        var cy = 40 + hash(c * 5.7) * H * 0.35;
        ctx.globalAlpha = z.underwater ? 0.16 : 0.75;
        cloud(ctx, cx, cy, 26 + hash(c) * 26, z.underwater ? '#e8fbff' : '#ffffff');
      }
      ctx.globalAlpha = 1;
    }

    // soleil / lune / projecteur
    var sx = W * 0.8, sy = H * 0.18;
    ctx.globalAlpha = 0.28;
    fill(ctx, z.sun, sx, sy, 62, 62);
    ctx.globalAlpha = 0.5;
    fill(ctx, z.sun, sx, sy, 46, 46);
    ctx.globalAlpha = 1;
    fill(ctx, z.sun, sx, sy, 32, 32);
    if (z.id === 'lune') {
      fill(ctx, z.sky[0], sx - 12, sy - 6, 26, 26); // croissant
    }
    if (z.id === 'cuisine') {
      ctx.globalAlpha = 0.25;
      for (var r = 0; r < 8; r++) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(r * 0.4 - 1.6) * 400, sy + Math.sin(r * 0.4 - 1.6) * 400);
        ctx.lineTo(sx + Math.cos(r * 0.4 - 1.4) * 400, sy + Math.sin(r * 0.4 - 1.4) * 400);
        ctx.closePath(); ctx.fillStyle = '#fff3c4'; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };

  function cloud(ctx, x, y, r, color) {
    fill(ctx, color, x, y, r, r * 0.62);
    fill(ctx, color, x - r * 0.8, y + r * 0.15, r * 0.6, r * 0.42);
    fill(ctx, color, x + r * 0.85, y + r * 0.18, r * 0.55, r * 0.4);
    fill(ctx, color, x + r * 0.2, y - r * 0.35, r * 0.55, r * 0.42);
  }

  // ------------------------------------------------------- collines lointaines
  CF.world.far = function (ctx, z, W, groundY, camX, t) {
    var off = camX * 0.18;
    var span = 260;
    var i0 = Math.floor(off / span) - 1;
    for (var i = i0; i < i0 + Math.ceil(W / span) + 3; i++) {
      var x = i * span - off;
      var kind = z.decorFar[i & 1 ? 0 : (Math.abs(i) % z.decorFar.length)];
      var s = 0.8 + hash(i * 1.7) * 0.5;
      decor(ctx, kind, x, groundY + 6, s, t, z, i, 0.55);
    }
    // silhouette de collines
    ctx.beginPath();
    ctx.moveTo(-10, groundY + 10);
    for (var k = 0; k <= Math.ceil(W / 90) + 1; k++) {
      var x2 = k * 90 - (off * 0.5) % 90 - 45;
      var h = 30 + hash(Math.floor((off * 0.5) / 90) + k) * 46;
      ctx.quadraticCurveTo(x2, groundY - h, x2 + 45, groundY + 8);
    }
    ctx.lineTo(W + 10, groundY + 10);
    ctx.closePath();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = z.hills.color; ctx.fill();
    ctx.globalAlpha = 1;
  };

  // ------------------------------------------------- décor de second plan
  CF.world.mid = function (ctx, z, W, groundY, camX, t) {
    var off = camX * 0.5;
    var span = 150;
    var i0 = Math.floor(off / span) - 1;
    for (var i = i0; i < i0 + Math.ceil(W / span) + 3; i++) {
      if (hash(i * 4.3) < 0.28) continue; // des trous pour respirer
      var kind = z.decorMid[Math.floor(hash(i * 2.1) * z.decorMid.length) % z.decorMid.length];
      var x = i * span - off + hash(i * 9.2) * 60;
      var s = 0.7 + hash(i * 3.7) * 0.7;
      decor(ctx, kind, x, groundY + 2, s, t, z, i, 1);
    }
  };

  // ---------------------------------------------------------------------- sol
  CF.world.ground = function (ctx, z, W, H, groundY, camX) {
    var g = z.ground;
    // bande d'herbe / nappe / fromage
    ctx.fillStyle = g.body;
    ctx.fillRect(0, groundY, W, H - groundY + 4);
    ctx.fillStyle = g.top;
    ctx.fillRect(0, groundY, W, 16);
    ctx.fillStyle = g.line;
    ctx.fillRect(0, groundY + 15, W, 3);

    var off = camX;
    if (g.checker) {
      var s = 46;
      var i0 = Math.floor(off / s) - 1;
      for (var i = i0; i < i0 + W / s + 2; i++) {
        for (var j = 0; j < Math.ceil((H - groundY) / s) + 1; j++) {
          if ((i + j) % 2) continue;
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.fillRect(i * s - off, groundY + 18 + j * s, s, s);
        }
      }
    } else if (g.tiles) {
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 3;
      var ts = 60, k0 = Math.floor(off / ts) - 1;
      for (var k = k0; k < k0 + W / ts + 2; k++) {
        ctx.beginPath(); ctx.moveTo(k * ts - off, groundY + 18); ctx.lineTo(k * ts - off, H); ctx.stroke();
      }
      for (var m = 1; m * 44 < H - groundY; m++) {
        ctx.beginPath(); ctx.moveTo(0, groundY + 18 + m * 44); ctx.lineTo(W, groundY + 18 + m * 44); ctx.stroke();
      }
    } else if (g.holes) {
      var hs = 120, h0 = Math.floor(off / hs) - 1;
      for (var q = h0; q < h0 + W / hs + 2; q++) {
        var hx = q * hs - off + hash(q * 5.5) * 50;
        var hy = groundY + 30 + hash(q * 8.1) * (H - groundY - 50);
        fill(ctx, g.bodyDark, hx, hy, 13 + hash(q) * 12, 9 + hash(q + 2) * 8);
        fill(ctx, 'rgba(255,255,255,.25)', hx - 3, hy - 4, 6, 4);
      }
    } else if (g.stripes) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, groundY + 18, W, H - groundY); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 14;
      for (var d = -H; d < W + H; d += 54) {
        var dx = d - (off % 54);
        ctx.beginPath(); ctx.moveTo(dx, H); ctx.lineTo(dx + (H - groundY), groundY + 18); ctx.stroke();
      }
      ctx.restore();
    } else {
      // terre avec cailloux + touffes d'herbe
      var ps = 90, p0 = Math.floor(off / ps) - 1;
      for (var n = p0; n < p0 + W / ps + 2; n++) {
        var px = n * ps - off + hash(n * 6.1) * 40;
        var py = groundY + 30 + hash(n * 2.9) * (H - groundY - 44);
        fill(ctx, g.bodyDark, px, py, 6 + hash(n) * 5, 4 + hash(n + 1) * 3);
      }
      ctx.strokeStyle = g.line; ctx.lineWidth = 3; ctx.lineCap = 'round';
      var gs = 34, g0 = Math.floor(off / gs) - 1;
      for (var u = g0; u < g0 + W / gs + 2; u++) {
        var gx = u * gs - off;
        var gh = 6 + hash(u * 1.3) * 7;
        ctx.beginPath();
        ctx.moveTo(gx, groundY + 2); ctx.lineTo(gx - 3, groundY - gh);
        ctx.moveTo(gx + 4, groundY + 2); ctx.lineTo(gx + 8, groundY - gh * 0.7);
        ctx.stroke();
      }
    }
  };

  // ------------------------------------------------- premier plan (parallaxe)
  CF.world.front = function (ctx, z, W, H, groundY, camX, t) {
    var off = camX * 1.22;
    var span = 620;
    var i0 = Math.floor(off / span) - 1;
    ctx.globalAlpha = 0.9;
    for (var i = i0; i < i0 + Math.ceil(W / span) + 2; i++) {
      if (hash(i * 12.7) < 0.45) continue;
      var kind = z.decorMid[Math.floor(hash(i * 7.3) * z.decorMid.length) % z.decorMid.length];
      decor(ctx, kind, i * span - off, H + 14, 2.1 + hash(i) * 0.6, t, z, i, 1);
    }
    ctx.globalAlpha = 1;
  };

  // voile coloré propre à la zone (eau, nuit…)
  CF.world.overlay = function (ctx, z, W, H, t) {
    if (z.underwater) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#0a5c8a';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.35;
      for (var i = 0; i < 18; i++) {
        var bx = (hash(i * 3.3) * W + Math.sin(t * 0.8 + i) * 20) % W;
        var by = H - ((t * (30 + hash(i) * 40) + hash(i * 5) * H) % (H + 40));
        ell(ctx, bx, by, 4 + hash(i) * 7, 4 + hash(i) * 7);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (z.stars) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#0a0a2a';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  };

  // ------------------------------------------------------------------ décors
  function decor(ctx, kind, x, y, s, t, z, i, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = (ctx.globalAlpha || 1) * (alpha == null ? 1 : alpha);
    switch (kind) {
      case 'hedge':
        fill(ctx, z.hills.color2, 0, -22, 58, 26);
        fill(ctx, shade(z.hills.color2, 0.1), -14, -34, 30, 22);
        break;
      case 'tree':
        capsule(ctx, 0, 0, 0, -54, 12, '#8b5a2b');
        fill(ctx, z.hills.color, 0, -74, 38, 32);
        fill(ctx, z.hills.color2, -22, -58, 24, 20);
        fill(ctx, shade(z.hills.color, 0.14), 12, -86, 20, 17);
        break;
      case 'flower':
        capsule(ctx, 0, 0, 0, -30, 4, '#5aa537');
        for (var p = 0; p < 6; p++) {
          var a = p / 6 * TAU + Math.sin(t * 1.5 + i) * 0.1;
          fill(ctx, ['#ff6b9d', '#ffd43b', '#a78bfa', '#ff922b'][i % 4], Math.cos(a) * 11, -34 + Math.sin(a) * 11, 8, 8);
        }
        fill(ctx, '#fff3a0', 0, -34, 7, 7);
        break;
      case 'mushroom':
        capsule(ctx, 0, 0, 0, -16, 10, '#fff3e0');
        ctx.beginPath(); ctx.ellipse(0, -18, 20, 14, 0, Math.PI, TAU); ctx.fillStyle = '#ff5d5d'; ctx.fill();
        fill(ctx, '#fff', -9, -22, 4, 3); fill(ctx, '#fff', 6, -24, 3.4, 3); fill(ctx, '#fff', 1, -18, 3, 2.6);
        break;
      case 'bush':
        fill(ctx, z.hills.color2, 0, -14, 30, 18);
        fill(ctx, z.hills.color, -12, -20, 18, 14);
        break;
      case 'snailHouse':
        fill(ctx, '#f6c99a', 0, -14, 16, 14);
        ctx.strokeStyle = '#d19a62'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, -14, 10, 0, TAU * 0.8); ctx.stroke();
        fill(ctx, '#8b5a2b', 14, -6, 8, 5);
        break;
      case 'shelf':
        rr(ctx, -70, -90, 140, 12, 4); ctx.fillStyle = '#c98a52'; ctx.fill();
        for (var j = 0; j < 3; j++) {
          rr(ctx, -56 + j * 40, -122, 26, 32, 5);
          ctx.fillStyle = ['#8ecae6', '#ffb703', '#a7c957'][j]; ctx.fill();
        }
        break;
      case 'window':
        rr(ctx, -50, -130, 100, 90, 10); ctx.fillStyle = '#bde3ff'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.stroke();
        capsule(ctx, 0, -130, 0, -40, 6, '#fff');
        capsule(ctx, -50, -85, 50, -85, 6, '#fff');
        break;
      case 'jar':
        rr(ctx, -16, -46, 32, 46, 8); ctx.fillStyle = 'rgba(190,225,255,.8)'; ctx.fill();
        rr(ctx, -18, -54, 36, 12, 4); ctx.fillStyle = '#e63946'; ctx.fill();
        break;
      case 'cup':
        ctx.beginPath(); ctx.moveTo(-14, -34); ctx.lineTo(14, -34); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#4dabf7'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(16, -20, 9, -1, 1.4); ctx.stroke();
        break;
      case 'crumb':
        fill(ctx, '#e0b74a', 0, -4, 6, 4); fill(ctx, '#e0b74a', 10, -3, 4, 3);
        break;
      case 'spoon':
        capsule(ctx, 0, 0, -6, -50, 5, '#cfd6de');
        ell(ctx, -8, -58, 10, 14, -0.2); ctx.fillStyle = '#e9eef3'; ctx.fill();
        break;
      case 'crater':
        fill(ctx, z.hills.color2, 0, -6, 60, 16);
        fill(ctx, shade(z.hills.color2, -0.2), 0, -4, 44, 10);
        break;
      case 'planet':
        fill(ctx, '#ff9e6d', 0, -70, 26, 26);
        ell(ctx, 0, -70, 40, 9, -0.3); ctx.strokeStyle = '#ffd0a8'; ctx.lineWidth = 4; ctx.stroke();
        break;
      case 'cheese':
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-14, -30); ctx.lineTo(20, -18); ctx.lineTo(20, 0); ctx.closePath();
        ctx.fillStyle = '#f6d365'; ctx.fill(); ctx.strokeStyle = '#d9ae41'; ctx.lineWidth = 2.5; ctx.stroke();
        fill(ctx, '#e0b74a', -4, -12, 5, 4);
        break;
      case 'flag':
        capsule(ctx, 0, 0, 0, -60, 4, '#e9ecef');
        ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(28, -52); ctx.lineTo(0, -42); ctx.closePath();
        ctx.fillStyle = '#ff5d8f'; ctx.fill();
        break;
      case 'star':
        star(ctx, 0, -18 + Math.sin(t * 2 + i) * 3, 11, 5); ctx.fillStyle = '#ffe66d'; ctx.fill();
        break;
      case 'rock':
        fill(ctx, '#6b6b93', 0, -10, 18, 12);
        fill(ctx, '#7f7fa8', -5, -14, 10, 7);
        break;
      case 'coral':
        for (var c = 0; c < 4; c++) {
          bend(ctx, c * 12 - 18, 0, c * 12 - 22 + Math.sin(t + c) * 4, -34, c * 12 - 10, -54 - c * 6, 8, ['#ff8fab', '#ffa94d', '#e599f7', '#63e6be'][c]);
        }
        break;
      case 'tilesWall':
        rr(ctx, -80, -120, 160, 120, 6); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
        for (var u = 1; u < 4; u++) { capsule(ctx, -80, -120 + u * 30, 80, -120 + u * 30, 2, 'rgba(255,255,255,.2)'); }
        for (var v = 1; v < 5; v++) { capsule(ctx, -80 + v * 32, -120, -80 + v * 32, 0, 2, 'rgba(255,255,255,.2)'); }
        break;
      case 'bubble':
        ell(ctx, Math.sin(t * 1.4 + i) * 8, -30 - ((t * 22 + i * 30) % 90), 9, 9);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke();
        break;
      case 'algae':
        for (var al = 0; al < 3; al++) {
          bend(ctx, al * 9 - 9, 0, al * 9 - 9 + Math.sin(t * 1.6 + al) * 12, -34, al * 9 - 9 + Math.sin(t * 1.6 + al + 1) * 16, -66, 7, al % 2 ? '#2f9e44' : '#40c057');
        }
        break;
      case 'fish':
        var fx = Math.sin(t * 0.9 + i * 2) * 26;
        fill(ctx, '#ffd43b', fx, -46, 14, 9);
        ctx.beginPath(); ctx.moveTo(fx - 12, -46); ctx.lineTo(fx - 24, -54); ctx.lineTo(fx - 24, -38); ctx.closePath();
        ctx.fillStyle = '#ffa94d'; ctx.fill();
        fill(ctx, '#2b2118', fx + 7, -48, 2.4, 2.4);
        break;
      case 'starfishDeco':
        star(ctx, 0, -12, 14, 5, 0.5); ctx.fillStyle = '#ff8787'; ctx.fill();
        break;
      case 'candyCane':
        bend(ctx, 0, 0, 0, -60, 18, -84, 12, '#fff');
        bend(ctx, 0, 0, 0, -60, 18, -84, 6, '#ff5d8f');
        break;
      case 'lollipopTree':
        capsule(ctx, 0, 0, 0, -50, 7, '#fff');
        fill(ctx, '#ff85a2', 0, -74, 26, 26);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, -74, 15, 0.5, 5.2); ctx.stroke();
        break;
      case 'gumdrop':
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 20, 0, Math.PI, TAU);
        ctx.fillStyle = ['#63e6be', '#ffa94d', '#b197fc'][i % 3]; ctx.fill();
        fill(ctx, 'rgba(255,255,255,.5)', -5, -12, 4, 3);
        break;
      case 'candy':
        fill(ctx, '#ff6b9d', 0, -12, 12, 9);
        ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(-24, -19); ctx.lineTo(-24, -5); ctx.closePath(); ctx.fillStyle = '#ffd43b'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(12, -12); ctx.lineTo(24, -19); ctx.lineTo(24, -5); ctx.closePath(); ctx.fill();
        break;
      case 'icecream':
        ctx.beginPath(); ctx.moveTo(-12, -22); ctx.lineTo(12, -22); ctx.lineTo(0, 4); ctx.closePath(); ctx.fillStyle = '#e0a458'; ctx.fill();
        fill(ctx, '#ffe3ee', 0, -34, 15, 14);
        fill(ctx, '#ff5d8f', 0, -50, 7, 7);
        break;
      case 'donut':
        ell(ctx, 0, -20, 20, 20); ctx.fillStyle = '#e0a458'; ctx.fill();
        ell(ctx, 0, -22, 19, 17); ctx.fillStyle = '#ffb3d9'; ctx.fill();
        ell(ctx, 0, -20, 7, 7); ctx.fillStyle = z.sky[1]; ctx.fill();
        break;
      default: break;
    }
    ctx.restore();
  }
  CF.world.decor = decor;

  // ---------------------------------------------------------------- obstacles
  var ART = {
    taupe: function (ctx, w, h, t) {
      ctx.beginPath(); ctx.ellipse(w / 2, 0, w / 2, h * 0.8, 0, Math.PI, TAU);
      ctx.fillStyle = '#8b5a2b'; ctx.fill();
      ctx.fillStyle = '#6f4520';
      for (var i = 0; i < 4; i++) fill(ctx, '#6f4520', 8 + i * 12, -h * 0.3 - (i % 2) * 6, 5, 4);
      // la taupe
      var up = (Math.sin(t * 2) * 0.5 + 0.5) * 10;
      fill(ctx, '#a97c50', w / 2, -h * 0.75 - up, 14, 12);
      fill(ctx, '#ffc0cb', w / 2 - 4, -h * 0.75 - up + 3, 3, 2.4);
      fill(ctx, '#ffc0cb', w / 2 + 4, -h * 0.75 - up + 3, 3, 2.4);
      fill(ctx, '#2b2118', w / 2 - 5, -h * 0.8 - up, 2, 2);
      fill(ctx, '#2b2118', w / 2 + 5, -h * 0.8 - up, 2, 2);
    },
    gnome: function (ctx, w, h, t) {
      rr(ctx, w * 0.18, -h * 0.45, w * 0.64, h * 0.45, 8); ctx.fillStyle = '#3d5afe'; ctx.fill();
      fill(ctx, '#ffd9b3', w / 2, -h * 0.52, w * 0.3, w * 0.3);
      ctx.beginPath(); ctx.moveTo(w * 0.14, -h * 0.6); ctx.lineTo(w / 2, -h); ctx.lineTo(w * 0.86, -h * 0.6); ctx.closePath();
      ctx.fillStyle = '#e63946'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(w / 2, -h * 0.46, w * 0.34, h * 0.16, 0, 0, Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
      fill(ctx, '#2b2118', w * 0.4, -h * 0.56, 2.4, 2.4);
      fill(ctx, '#2b2118', w * 0.6, -h * 0.56, 2.4, 2.4);
      fill(ctx, '#ff8fab', w / 2, -h * 0.5, 4, 3);
      capsule(ctx, w * 0.1, -h * 0.2, w * 0.9, -h * 0.2, 5, '#2b3ea8');
    },
    tuyau: function (ctx, w, h, t) {
      ctx.strokeStyle = '#40c057'; ctx.lineWidth = 11; ctx.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(w / 2, -8 - i * 8, w / 2 - i * 8, 10, 0, 0, TAU); ctx.stroke();
      }
      rr(ctx, w - 18, -h - 6, 18, 14, 4); ctx.fillStyle = '#ffd43b'; ctx.fill();
      ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w - 10, -h + 8); ctx.lineTo(w - 10, -h + 20); ctx.stroke();
    },
    tondeuse: function (ctx, w, h, t) {
      rr(ctx, 4, -h, w - 8, h * 0.7, 10); ctx.fillStyle = '#e63946'; ctx.fill();
      ctx.strokeStyle = '#a4161a'; ctx.lineWidth = 3; ctx.stroke();
      rr(ctx, w * 0.3, -h - 16, w * 0.3, 18, 5); ctx.fillStyle = '#adb5bd'; ctx.fill();
      fill(ctx, '#343a40', w * 0.24, -6, 12, 12);
      fill(ctx, '#343a40', w * 0.76, -6, 12, 12);
      fill(ctx, '#adb5bd', w * 0.24, -6, 4, 4);
      fill(ctx, '#adb5bd', w * 0.76, -6, 4, 4);
      ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(w * 0.8, -h * 0.8); ctx.lineTo(w + 8, -h - 20); ctx.stroke();
      fill(ctx, '#ffd43b', w * 0.45, -h * 0.6, 6, 6);
    },
    abeille: function (ctx, w, h, t) {
      var fl = Math.sin(t * 30) * 8;
      ell(ctx, w * 0.35, -h - 6 + fl * 0.2, 13, 8, -0.4); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
      ell(ctx, w * 0.62, -h - 6 - fl * 0.2, 13, 8, 0.4); ctx.fill();
      ell(ctx, w / 2, -h / 2 + fl * 0.3, w * 0.36, h * 0.4); ctx.fillStyle = '#ffd43b'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(w / 2, -h / 2 + fl * 0.3, w * 0.36, h * 0.4, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = '#2b2118';
      for (var i = 0; i < 3; i++) ctx.fillRect(w * 0.24 + i * 12, -h, 6, h * 2);
      ctx.restore();
      fill(ctx, '#2b2118', w * 0.78, -h * 0.55 + fl * 0.3, 2.6, 2.6);
      capsule(ctx, w * 0.14, -h * 0.5, w * 0.02, -h * 0.62, 3, '#2b2118');
    },
    banane: function (ctx, w, h, t) {
      ctx.beginPath();
      ctx.moveTo(2, -4);
      ctx.quadraticCurveTo(w / 2, -h - 12, w - 2, -4);
      ctx.quadraticCurveTo(w / 2, -h + 8, 2, -4);
      ctx.closePath();
      ctx.fillStyle = '#ffd43b'; ctx.fill();
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2.5; ctx.stroke();
      capsule(ctx, 4, -5, 12, -12, 5, '#8b6b1f');
      capsule(ctx, w - 4, -5, w - 12, -12, 5, '#8b6b1f');
    },
    grillepain: function (ctx, w, h, t) {
      rr(ctx, 0, -h, w, h, 10); ctx.fillStyle = '#ced4da'; ctx.fill();
      ctx.strokeStyle = '#868e96'; ctx.lineWidth = 3; ctx.stroke();
      rr(ctx, w * 0.15, -h * 0.75, w * 0.5, h * 0.45, 6); ctx.fillStyle = '#adb5bd'; ctx.fill();
      var pop = Math.abs(Math.sin(t * 1.6)) * 12;
      rr(ctx, w * 0.24, -h - 14 - pop, w * 0.5, 22, 6); ctx.fillStyle = '#e0a458'; ctx.fill();
      ctx.strokeStyle = '#b5762c'; ctx.lineWidth = 2; ctx.stroke();
      fill(ctx, '#ff5d5d', w * 0.82, -h * 0.5, 6, 6);
      capsule(ctx, w * 0.78, -h * 0.3, w * 0.9, -h * 0.18, 4, '#495057');
    },
    brique: function (ctx, w, h, t) {
      rr(ctx, 0, -h, w, h, 4); ctx.fillStyle = '#f8f9fa'; ctx.fill();
      ctx.strokeStyle = '#ced4da'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -h + 14); ctx.lineTo(w / 2, -h); ctx.lineTo(w, -h + 14); ctx.closePath();
      ctx.fillStyle = '#e9ecef'; ctx.fill();
      rr(ctx, 5, -h * 0.65, w - 10, h * 0.35, 4); ctx.fillStyle = '#4dabf7'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('LAIT', w / 2, -h * 0.4);
      ctx.textAlign = 'left';
    },
    casserole: function (ctx, w, h, t) {
      rr(ctx, 2, -h * 0.75, w - 4, h * 0.75, 8); ctx.fillStyle = '#495057'; ctx.fill();
      ctx.strokeStyle = '#212529'; ctx.lineWidth = 3; ctx.stroke();
      ell(ctx, w / 2, -h * 0.78, w / 2 - 2, 9); ctx.fillStyle = '#adb5bd'; ctx.fill();
      fill(ctx, '#868e96', w / 2, -h * 0.88, 8, 6);
      capsule(ctx, w - 4, -h * 0.5, w + 22, -h * 0.62, 6, '#212529');
      ctx.globalAlpha = 0.5;
      for (var i = 0; i < 3; i++) {
        fill(ctx, '#fff', w * 0.3 + i * 12, -h - 10 - ((t * 24 + i * 20) % 40), 7 - i, 6 - i);
      }
      ctx.globalAlpha = 1;
    },
    tartine: function (ctx, w, h, t) {
      var fl = Math.sin(t * 22) * 6;
      ell(ctx, w * 0.3, -h - 4 + fl, 11, 6, -0.3); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
      ell(ctx, w * 0.7, -h - 4 - fl, 11, 6, 0.3); ctx.fill();
      rr(ctx, w * 0.15, -h * 0.85, w * 0.7, h * 0.75, 7); ctx.fillStyle = '#e0a458'; ctx.fill();
      rr(ctx, w * 0.24, -h * 0.7, w * 0.52, h * 0.5, 5); ctx.fillStyle = '#ffd43b'; ctx.fill();
      fill(ctx, '#2b2118', w * 0.4, -h * 0.5, 2.6, 2.6);
      fill(ctx, '#2b2118', w * 0.6, -h * 0.5, 2.6, 2.6);
      ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w * 0.5, -h * 0.42, 5, 0.2, Math.PI - 0.2); ctx.stroke();
    },
    cratere: function (ctx, w, h, t) {
      ell(ctx, w / 2, -2, w / 2, h * 0.7); ctx.fillStyle = '#8a6d2a'; ctx.fill();
      ell(ctx, w / 2, -1, w / 2 - 7, h * 0.5); ctx.fillStyle = '#4a3a17'; ctx.fill();
      ctx.strokeStyle = '#f6d365'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(w / 2, -4, w / 2, h * 0.6, 0, Math.PI, TAU); ctx.stroke();
    },
    fromage: function (ctx, w, h, t) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.15, -h); ctx.lineTo(w, -h * 0.7); ctx.lineTo(w, 0); ctx.closePath();
      ctx.fillStyle = '#f6d365'; ctx.fill();
      ctx.strokeStyle = '#d9ae41'; ctx.lineWidth = 3; ctx.stroke();
      fill(ctx, '#e0b74a', w * 0.4, -h * 0.35, 8, 6);
      fill(ctx, '#e0b74a', w * 0.7, -h * 0.55, 6, 5);
      fill(ctx, '#fff3c4', w * 0.25, -h * 0.7, 7, 5);
    },
    fusee: function (ctx, w, h, t) {
      ctx.beginPath(); ctx.moveTo(w / 2, -h); ctx.quadraticCurveTo(w, -h * 0.6, w * 0.85, -h * 0.1);
      ctx.lineTo(w * 0.15, -h * 0.1); ctx.quadraticCurveTo(0, -h * 0.6, w / 2, -h); ctx.closePath();
      ctx.fillStyle = '#e9ecef'; ctx.fill(); ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2, -h); ctx.quadraticCurveTo(w * 0.82, -h * 0.72, w * 0.8, -h * 0.55);
      ctx.lineTo(w * 0.2, -h * 0.55); ctx.quadraticCurveTo(w * 0.18, -h * 0.72, w / 2, -h); ctx.closePath();
      ctx.fillStyle = '#ff5d5d'; ctx.fill();
      fill(ctx, '#4dabf7', w / 2, -h * 0.42, 9, 9);
      ctx.beginPath(); ctx.moveTo(w * 0.15, -h * 0.15); ctx.lineTo(-4, 0); ctx.lineTo(w * 0.2, -h * 0.02); ctx.closePath(); ctx.fillStyle = '#ff5d5d'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(w * 0.85, -h * 0.15); ctx.lineTo(w + 4, 0); ctx.lineTo(w * 0.8, -h * 0.02); ctx.closePath(); ctx.fill();
      for (var i = 0; i < 2; i++) {
        var fl = 10 + Math.sin(t * 26 + i) * 6;
        ctx.beginPath(); ctx.moveTo(w * 0.35 + i * w * 0.2, 0); ctx.lineTo(w * 0.42 + i * w * 0.2, fl); ctx.lineTo(w * 0.5 + i * w * 0.2, 0);
        ctx.closePath(); ctx.fillStyle = i ? '#ffd43b' : '#ff922b'; ctx.fill();
      }
    },
    vache: function (ctx, w, h, t) {
      var bob = Math.sin(t * 3) * 4;
      ctx.save(); ctx.translate(0, bob);
      capsule(ctx, w * 0.25, -h * 0.25, w * 0.25, 0, 8, '#495057');
      capsule(ctx, w * 0.75, -h * 0.25, w * 0.75, 0, 8, '#495057');
      ell(ctx, w / 2, -h * 0.55, w * 0.42, h * 0.36); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#dee2e6'; ctx.lineWidth = 2.5; ctx.stroke();
      fill(ctx, '#343a40', w * 0.36, -h * 0.66, 11, 8, 0.4);
      fill(ctx, '#343a40', w * 0.62, -h * 0.44, 9, 7, -0.3);
      fill(ctx, '#fff', w * 0.86, -h * 0.72, 13, 12);
      fill(ctx, '#ffc0cb', w * 0.9, -h * 0.66, 8, 6);
      fill(ctx, '#2b2118', w * 0.84, -h * 0.78, 2.4, 2.4);
      ell(ctx, w * 0.12, -h * 0.78, 6, 5); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
    },
    bouee: function (ctx, w, h, t) {
      var y = -h / 2 + Math.sin(t * 2) * 3;
      ell(ctx, w / 2, y, w / 2, h / 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 2; ctx.stroke();
      for (var i = 0; i < 4; i++) {
        var a = i * TAU / 4 + 0.4;
        ctx.save(); ctx.translate(w / 2, y); ctx.rotate(a);
        rr(ctx, -8, -h / 2, 16, h, 4); ctx.fillStyle = '#ff5d5d'; ctx.fill();
        ctx.restore();
      }
      ell(ctx, w / 2, y, w * 0.19, h * 0.19); ctx.fillStyle = 'rgba(120,200,230,.6)'; ctx.fill();
      ell(ctx, w / 2, y, w / 2, h / 2); ctx.strokeStyle = '#e03131'; ctx.lineWidth = 3; ctx.stroke();
    },
    seau: function (ctx, w, h, t) {
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(w, -h); ctx.lineTo(w * 0.82, 0); ctx.lineTo(w * 0.18, 0); ctx.closePath();
      ctx.fillStyle = '#ff922b'; ctx.fill(); ctx.strokeStyle = '#d9700f'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, -h, w * 0.5, Math.PI, TAU); ctx.strokeStyle = '#495057'; ctx.lineWidth = 4; ctx.stroke();
      fill(ctx, '#ffd8a8', w * 0.35, -h * 0.5, 7, 5);
      fill(ctx, '#4dabf7', w * 0.5, -h - 4, 8, 6); // eau qui déborde
    },
    crabe: function (ctx, w, h, t) {
      var pin = Math.sin(t * 4) * 0.25;
      ell(ctx, w / 2, -h * 0.5, w * 0.36, h * 0.42); ctx.fillStyle = '#ff6b6b'; ctx.fill();
      ctx.strokeStyle = '#d94848'; ctx.lineWidth = 2.5; ctx.stroke();
      for (var i = 0; i < 3; i++) {
        capsule(ctx, w * 0.25 + i * 8, -h * 0.3, w * 0.12 + i * 6, 0, 4, '#d94848');
        capsule(ctx, w * 0.75 - i * 8, -h * 0.3, w * 0.88 - i * 6, 0, 4, '#d94848');
      }
      ctx.save(); ctx.translate(w * 0.1, -h * 0.75); ctx.rotate(-0.4 + pin);
      ell(ctx, -6, -4, 11, 8, -0.4); ctx.fillStyle = '#ff8787'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-22, -14); ctx.lineTo(-14, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(w * 0.9, -h * 0.75); ctx.rotate(0.4 - pin);
      ell(ctx, 6, -4, 11, 8, 0.4); ctx.fillStyle = '#ff8787'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(22, -14); ctx.lineTo(14, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
      capsule(ctx, w * 0.4, -h * 0.9, w * 0.4, -h * 1.15, 3, '#d94848');
      capsule(ctx, w * 0.6, -h * 0.9, w * 0.6, -h * 1.15, 3, '#d94848');
      fill(ctx, '#fff', w * 0.4, -h * 1.2, 5, 5);
      fill(ctx, '#fff', w * 0.6, -h * 1.2, 5, 5);
      fill(ctx, '#2b2118', w * 0.4, -h * 1.2, 2.4, 2.4);
      fill(ctx, '#2b2118', w * 0.6, -h * 1.2, 2.4, 2.4);
    },
    meduse: function (ctx, w, h, t) {
      var pu = 1 + Math.sin(t * 3) * 0.12;
      ctx.save(); ctx.translate(0, Math.sin(t * 2) * 4);
      ctx.beginPath(); ctx.ellipse(w / 2, -h * 0.55, w * 0.48 * pu, h * 0.42, 0, Math.PI, TAU);
      ctx.fillStyle = 'rgba(224,170,255,.92)'; ctx.fill();
      ctx.strokeStyle = '#b57be0'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(224,170,255,.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (var i = 0; i < 5; i++) {
        var x = w * 0.18 + i * w * 0.16;
        bend(ctx, x, -h * 0.55, x + Math.sin(t * 3 + i) * 8, -h * 0.25, x + Math.sin(t * 3 + i + 1) * 10, 0, 4, 'rgba(224,170,255,.9)');
      }
      fill(ctx, '#4a2d6b', w * 0.38, -h * 0.68, 3, 3);
      fill(ctx, '#4a2d6b', w * 0.62, -h * 0.68, 3, 3);
      ctx.restore();
    },
    sucette: function (ctx, w, h, t) {
      capsule(ctx, w / 2, 0, w / 2, -h * 0.55, 7, '#fff');
      fill(ctx, '#ff5d8f', w / 2, -h * 0.72, w * 0.52, w * 0.52);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(w / 2, -h * 0.72, w * 0.3, t % TAU, (t % TAU) + 4); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, -h * 0.72, w * 0.15, (t % TAU) + 1, (t % TAU) + 5); ctx.stroke();
      fill(ctx, 'rgba(255,255,255,.5)', w * 0.36, -h * 0.82, 4, 3);
    },
    gateau: function (ctx, w, h, t) {
      rr(ctx, 0, -h, w, h, 8); ctx.fillStyle = '#c98a52'; ctx.fill();
      rr(ctx, 0, -h, w, h * 0.3, 8); ctx.fillStyle = '#ffe3ee'; ctx.fill();
      ctx.fillStyle = '#ff85a2';
      for (var i = 0; i < 6; i++) fill(ctx, '#ff85a2', 8 + i * (w - 16) / 5, -h * 0.72, 6, 6);
      rr(ctx, w * 0.4, -h - 22, 7, 24, 3); ctx.fillStyle = '#ffd43b'; ctx.fill();
      var fl = 5 + Math.sin(t * 18) * 2;
      ell(ctx, w * 0.4 + 3.5, -h - 24 - fl * 0.6, 4, fl); ctx.fillStyle = '#ff922b'; ctx.fill();
      ell(ctx, w * 0.4 + 3.5, -h - 24 - fl * 0.5, 2, fl * 0.5); ctx.fillStyle = '#fff3a0'; ctx.fill();
    },
    chocolat: function (ctx, w, h, t) {
      rr(ctx, 0, -h, w, h, 4); ctx.fillStyle = '#6f4e37'; ctx.fill();
      ctx.strokeStyle = '#4e3524'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = '#8b6244'; ctx.lineWidth = 2.5;
      for (var i = 1; i < 3; i++) { capsule(ctx, w * i / 3, -h + 4, w * i / 3, -4, 2.5, '#8b6244'); }
      for (var j = 1; j < 4; j++) { capsule(ctx, 4, -h * j / 4, w - 4, -h * j / 4, 2.5, '#8b6244'); }
      rr(ctx, w * 0.1, -h * 0.75, w * 0.8, h * 0.3, 3); ctx.fillStyle = '#ffd43b'; ctx.fill();
    },
    glue: function (ctx, w, h, t) {
      var wo = Math.sin(t * 2) * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w * 0.2, -h - wo, w * 0.5, -h * 0.9);
      ctx.quadraticCurveTo(w * 0.8, -h - wo * 0.5, w, 0);
      ctx.closePath();
      ctx.fillStyle = '#ff85a2'; ctx.fill();
      ctx.strokeStyle = '#e05c7c'; ctx.lineWidth = 2.5; ctx.stroke();
      fill(ctx, 'rgba(255,255,255,.6)', w * 0.3, -h * 0.5, 6, 4);
      fill(ctx, '#2b2118', w * 0.4, -h * 0.35, 2.4, 2.4);
      fill(ctx, '#2b2118', w * 0.6, -h * 0.35, 2.4, 2.4);
    },
    frelon: function (ctx, w, h, t) {
      var fl = Math.sin(t * 26) * 7;
      ell(ctx, w * 0.35, -h - 4 + fl, 12, 7, -0.4); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
      ell(ctx, w * 0.65, -h - 4 - fl, 12, 7, 0.4); ctx.fill();
      ell(ctx, w / 2, -h / 2, w * 0.38, h * 0.42); ctx.fillStyle = '#b197fc'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(w / 2, -h / 2, w * 0.38, h * 0.42, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = '#5f3dc4';
      for (var i = 0; i < 3; i++) ctx.fillRect(w * 0.22 + i * 13, -h, 7, h * 2);
      ctx.restore();
      fill(ctx, '#fff', w * 0.72, -h * 0.6, 4, 4);
      fill(ctx, '#2b2118', w * 0.73, -h * 0.6, 2, 2);
      capsule(ctx, w * 0.16, -h * 0.5, w * 0.02, -h * 0.66, 3, '#5f3dc4');
    },
  };
  CF.world.art = ART;

  // Dessine un obstacle : o = {x, y(bas), w, h, art, t}
  CF.world.obstacle = function (ctx, o, t) {
    var fn = ART[o.art];
    if (!fn) { rr(ctx, o.x, o.y - o.h, o.w, o.h, 6); ctx.fillStyle = '#c00'; ctx.fill(); return; }
    ctx.save();
    ctx.translate(o.x, o.y);
    fn(ctx, o.w, o.h, t);
    ctx.restore();
  };

  // ------------------------------------------------------------------ bonbons
  CF.world.candy = function (ctx, x, y, r, t, kind) {
    kind = kind || 0;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3 + x * 0.02) * 4);
    ctx.rotate(Math.sin(t * 2 + x * 0.01) * 0.2);
    if (kind % 3 === 0) {
      // bonbon emballé
      fill(ctx, '#ff5d8f', 0, 0, r, r * 0.75);
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r * 1.9, -r * 0.8); ctx.lineTo(-r * 1.9, r * 0.8); ctx.closePath(); ctx.fillStyle = '#ffd43b'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r * 1.9, -r * 0.8); ctx.lineTo(r * 1.9, r * 0.8); ctx.closePath(); ctx.fill();
      fill(ctx, 'rgba(255,255,255,.7)', -r * 0.3, -r * 0.25, r * 0.28, r * 0.18);
    } else if (kind % 3 === 1) {
      // étoile
      star(ctx, 0, 0, r * 1.3, 5); ctx.fillStyle = '#ffd43b'; ctx.fill();
      ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 2; ctx.stroke();
      fill(ctx, 'rgba(255,255,255,.8)', -r * 0.3, -r * 0.3, r * 0.25, r * 0.2);
    } else {
      // sucette ronde
      capsule(ctx, 0, r, 0, r * 2.4, 3, '#fff');
      fill(ctx, '#4dabf7', 0, 0, r, r);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 4.5); ctx.stroke();
    }
    ctx.restore();
  };

  // ------------------------------------------------------------ ligne d'arrivée
  CF.world.finish = function (ctx, x, groundY, H, t) {
    var w = 26, top = groundY - 210;
    // poteaux
    rr(ctx, x - w, top, w, groundY - top, 4); ctx.fillStyle = '#e9ecef'; ctx.fill();
    rr(ctx, x + 90, top, w, groundY - top, 4); ctx.fillStyle = '#e9ecef'; ctx.fill();
    // damier
    var s = 13;
    for (var i = 0; i < 2; i++) {
      for (var j = 0; j < 8; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#212529' : '#f8f9fa';
        ctx.fillRect(x - w + i * s, top + 10 + j * s, s, s);
        ctx.fillRect(x + 90 + i * s, top + 10 + j * s, s, s);
      }
    }
    // banderole
    rr(ctx, x - w - 6, top - 34, 90 + w * 2 + 12, 40, 8);
    ctx.fillStyle = '#ff5d8f'; ctx.fill();
    ctx.strokeStyle = '#d6336c'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARRIVÉE !', x + 52, top - 5);
    ctx.textAlign = 'left';
    // confettis qui tombent
    for (var k = 0; k < 20; k++) {
      var cx = x - 40 + hash(k * 3.3) * 200;
      var cy = ((t * 60 + hash(k) * 300) % 300) + top - 60;
      fill(ctx, ['#ffd43b', '#4dabf7', '#69db7c', '#ff85a2'][k % 4], cx, cy, 4, 6, t * 3 + k);
    }
  };

  // ------------------------------------------------- effet de changement de décor
  CF.world.wipe = function (ctx, W, H, p) {
    // p : 0 -> 1 (rideau qui balaie l'écran)
    var x = -W * 0.4 + p * W * 1.8;
    var g = ctx.createLinearGradient(x - W * 0.4, 0, x + W * 0.4, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
})(window.CF);
