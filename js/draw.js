/* ============================================================================
   DESSIN — tout est tracé au canvas, aucune image externe.
   Ce fichier s'occupe des personnages et de leurs vêtements.
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  // ------------------------------------------------------------- petits outils
  var TAU = Math.PI * 2;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(n) { var x = Math.sin(n * 127.1 + 0.7) * 43758.5453; return x - Math.floor(x); }

  function shade(hex, amt) {
    // éclaircit (amt>0) ou assombrit (amt<0) une couleur #rrggbb
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU);
  }

  function fill(ctx, color, x, y, rx, ry, rot) {
    ell(ctx, x, y, rx, ry, rot); ctx.fillStyle = color; ctx.fill();
  }

  function capsule(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function bend(ctx, x1, y1, cx, cy, x2, y2, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
  }

  function star(ctx, x, y, r, points, inner) {
    points = points || 5; inner = inner == null ? 0.45 : inner;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var rad = i % 2 === 0 ? r : r * inner;
      var a = (i / (points * 2)) * TAU - Math.PI / 2;
      var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function outline(ctx, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w || 3; ctx.lineJoin = 'round'; ctx.stroke(); }

  // ------------------------------------------------------------------ squelettes
  var SPECIES = {
    cat:      { bodyRx: 26, bodyRy: 25, bodyY: -52, headR: 23, headY: -86, hipY: -34, shY: -66, arm: 26, leg: 30 },
    elephant: { bodyRx: 32, bodyRy: 29, bodyY: -54, headR: 26, headY: -88, hipY: -34, shY: -68, arm: 28, leg: 30, tutu: true },
    chicken:  { bodyRx: 23, bodyRy: 22, bodyY: -46, headR: 19, headY: -74, hipY: -30, shY: -56, arm: 20, leg: 26, wings: true },
    potato:   { bodyRx: 29, bodyRy: 33, bodyY: -42, headR: 0,  headY: 0,   hipY: -20, shY: -46, arm: 20, leg: 18, headless: true },
  };

  // ------------------------------------------------------------------- poses
  function defaultPose() {
    return { phase: 0, air: 0, onGround: true, vy: 0, squash: 0, stumble: 0, hurt: false, t: 0, lean: 0, joy: 0, flap: 0, speed: 1 };
  }

  // Position d'une jambe pendant le cycle de course.
  function legPose(S, i, pose) {
    var a = pose.phase + i * Math.PI;
    var s = Math.sin(a);
    var hipY = S.hipY;
    // au sol : le pied se pose et se soulève pendant la phase de retour
    var gx = s * 21, gy = -Math.max(0, s + 0.3) * 13;
    // en l'air : les jambes se replient
    var ax = (i ? 6 : 13) + s * 3, ay = hipY + (i ? 17 : 12);
    var t = pose.air;
    return {
      x: lerp(gx, ax, t), y: lerp(gy, ay, t),
      kx: lerp(s * 9 + 4, 11, t), ky: lerp(hipY + 15 - Math.max(0, s) * 7, hipY + 11, t),
    };
  }

  function armPose(S, i, pose) {
    var a = pose.phase + i * Math.PI + Math.PI;
    var sy = S.shY;
    var hx = Math.sin(a) * 15 + 5;
    var hy = sy + S.arm - Math.max(0, Math.sin(a)) * 5;
    var t = clamp(pose.air + pose.joy, 0, 1);
    // bras levés quand on saute (ou quand on a gagné)
    hx = lerp(hx, (i ? -2 : 12) + Math.sin(pose.t * 6 + i) * 3 * pose.joy, t);
    hy = lerp(hy, sy - (i ? 8 : 14) - pose.joy * 6, t);
    if (pose.flap > 0) {  // la poulette bat des ailes
      var w = Math.sin(pose.t * 26) * 0.9 * pose.flap;
      hy += w * 10; hx += (i ? -4 : 6) * pose.flap;
    }
    return { x: hx, y: hy, ex: lerp(0, hx, 0.5) + 2, ey: lerp(sy, hy, 0.55) };
  }

  // ------------------------------------------------------------------ visage
  function drawFace(ctx, spec, rig, pose) {
    var p = spec.palette, hx = rig.hx, hy = rig.hy, r = rig.hr;
    var ex = r * 0.36, ey = hy - r * 0.08;
    var blink = (pose.t % 3.4) > 3.28 ? 1 : 0;
    var er = r * 0.30;

    // yeux
    for (var i = -1; i <= 1; i += 2) {
      var x = hx + ex * i + r * 0.22;
      if (blink || pose.hurt) {
        capsule(ctx, x - er * 0.8, ey, x + er * 0.8, ey, 3, '#2b2118');
        if (pose.hurt) {
          // yeux en croix : ça tourne !
          capsule(ctx, x - er * 0.7, ey - er * 0.7, x + er * 0.7, ey + er * 0.7, 2.6, '#2b2118');
          capsule(ctx, x - er * 0.7, ey + er * 0.7, x + er * 0.7, ey - er * 0.7, 2.6, '#2b2118');
        }
        continue;
      }
      fill(ctx, '#ffffff', x, ey, er, er * 1.05);
      fill(ctx, p.eye, x + er * 0.22, ey + er * 0.05, er * 0.52, er * 0.56);
      fill(ctx, '#ffffff', x + er * 0.42, ey - er * 0.32, er * 0.19, er * 0.19);
      // sourcil
      capsule(ctx, x - er * 0.85, ey - er * 1.25, x + er * 0.7, ey - er * 1.45, 2.6, shade(p.skin, -0.35));
    }

    // joues roses
    ctx.globalAlpha = 0.45;
    fill(ctx, '#ff8fab', hx - r * 0.62, hy + r * 0.28, r * 0.22, r * 0.15);
    fill(ctx, '#ff8fab', hx + r * 0.72, hy + r * 0.28, r * 0.22, r * 0.15);
    ctx.globalAlpha = 1;

    // bouche
    var mx = hx + r * 0.22, my = hy + r * 0.44;
    ctx.strokeStyle = '#4a3325'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath();
    if (pose.hurt) {
      ctx.moveTo(mx - r * 0.3, my + 2);
      ctx.quadraticCurveTo(mx, my - r * 0.18, mx + r * 0.3, my + 2);
    } else if (pose.air > 0.5 || pose.joy > 0.4) {
      ell(ctx, mx, my, r * 0.17, r * 0.22); ctx.fillStyle = '#8c3b3b'; ctx.fill();
    } else {
      ctx.moveTo(mx - r * 0.26, my - r * 0.06);
      ctx.quadraticCurveTo(mx, my + r * 0.30, mx + r * 0.28, my - r * 0.06);
    }
    ctx.stroke();
  }

  // ------------------------------------------------------------------ espèces
  function drawHead(ctx, S, spec, rig, pose, outfit) {
    var p = spec.palette, hx = rig.hx, hy = rig.hy, r = rig.hr;
    var sk = p.skin, dk = shade(sk, -0.18);

    if (S.headless) return; // la patate a son visage sur le corps

    // oreilles / accessoires d'espèce DERRIÈRE la tête
    if (spec.species === 'cat') {
      for (var i = 0; i < 2; i++) {
        var ox = hx + (i ? r * 0.62 : -r * 0.55), oy = hy - r * 0.72;
        ctx.beginPath();
        ctx.moveTo(ox - r * 0.42, oy + r * 0.42);
        ctx.lineTo(ox - r * 0.1, oy - r * 0.62);
        ctx.lineTo(ox + r * 0.4, oy + r * 0.3);
        ctx.closePath();
        ctx.fillStyle = i ? sk : dk; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ox - r * 0.2, oy + r * 0.22);
        ctx.lineTo(ox - r * 0.05, oy - r * 0.28);
        ctx.lineTo(ox + r * 0.2, oy + r * 0.16);
        ctx.closePath();
        ctx.fillStyle = p.accent; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    if (spec.species === 'elephant') {
      fill(ctx, dk, hx - r * 0.78, hy - r * 0.05, r * 0.72, r * 0.78, -0.15);
      fill(ctx, shade(p.accent, 0.25), hx - r * 0.78, hy - r * 0.05, r * 0.44, r * 0.5, -0.15);
    }
    if (spec.species === 'chicken') {
      // crête
      for (var c = 0; c < 3; c++) {
        fill(ctx, p.accent, hx - r * 0.28 + c * r * 0.34, hy - r * 0.95 + (c === 1 ? -r * 0.1 : 0), r * 0.24, r * 0.3);
      }
    }

    // tête
    fill(ctx, sk, hx, hy, r * 0.96, r);
    fill(ctx, shade(sk, 0.14), hx - r * 0.2, hy - r * 0.35, r * 0.6, r * 0.42);

    // visage
    drawFace(ctx, spec, rig, pose);

    // détails d'espèce DEVANT
    if (spec.species === 'cat') {
      // museau + moustaches
      fill(ctx, shade(sk, 0.3), hx + r * 0.2, hy + r * 0.3, r * 0.3, r * 0.22);
      fill(ctx, p.accent, hx + r * 0.24, hy + r * 0.2, r * 0.09, r * 0.07);
      ctx.strokeStyle = 'rgba(60,40,25,.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (var w = -1; w <= 1; w += 2) {
        for (var k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.moveTo(hx + r * 0.35, hy + r * 0.3 + k * 4);
          ctx.lineTo(hx + r * 0.35 + w * r * 0.05 + r * 0.7, hy + r * 0.24 + k * 6 - 3);
          ctx.stroke();
        }
      }
    }
    if (spec.species === 'elephant') {
      // trompe qui se balance
      var sw = Math.sin(pose.phase * 0.5 + pose.t * 2) * 6;
      bend(ctx, hx + r * 0.5, hy + r * 0.35, hx + r * 1.05, hy + r * 0.9 + sw * 0.4, hx + r * 0.72 + sw, hy + r * 1.55 + sw * 0.3, r * 0.52, sk);
      bend(ctx, hx + r * 0.5, hy + r * 0.35, hx + r * 1.05, hy + r * 0.9 + sw * 0.4, hx + r * 0.72 + sw, hy + r * 1.55 + sw * 0.3, r * 0.2, shade(sk, 0.18));
      fill(ctx, '#fff8e7', hx + r * 0.28, hy + r * 0.62, r * 0.1, r * 0.2, 0.4); // défenses
    }
    if (spec.species === 'chicken') {
      // bec + barbillon
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.72, hy - r * 0.02);
      ctx.lineTo(hx + r * 1.35, hy + r * 0.16);
      ctx.lineTo(hx + r * 0.72, hy + r * 0.4);
      ctx.closePath();
      ctx.fillStyle = '#ffab2e'; ctx.fill();
      fill(ctx, '#ff5252', hx + r * 0.62, hy + r * 0.55, r * 0.16, r * 0.22);
    }
    if (outfit && outfit.tete) CLOTH_ART[outfit.tete](ctx, rig, pose, spec, 'head');
  }

  // corps + visage de la patate (espèce sans tête)
  function drawPotatoHead(ctx, spec, rig, pose) {
    var hx = rig.bx + 2, hy = rig.by - rig.bry * 0.3, r = rig.brx * 0.62;
    drawFace(ctx, spec, { hx: hx, hy: hy, hr: r }, pose);
    // lunettes de savant
    ctx.strokeStyle = '#3b3b3b'; ctx.lineWidth = 2.4;
    ell(ctx, hx - r * 0.42, hy - r * 0.05, r * 0.36, r * 0.34); ctx.stroke();
    ell(ctx, hx + r * 0.52, hy - r * 0.05, r * 0.36, r * 0.34); ctx.stroke();
    capsule(ctx, hx - r * 0.08, hy - r * 0.05, hx + r * 0.18, hy - r * 0.05, 2.2, '#3b3b3b');
    // germes sur le dessus
    for (var i = 0; i < 2; i++) {
      var sx = rig.bx - 10 + i * 22, sy = rig.by - rig.bry * 0.92;
      var w = Math.sin(pose.t * 2 + i) * 4;
      bend(ctx, sx, sy, sx + w * 0.5, sy - 14, sx + w, sy - 22, 3.4, '#7ec850');
      fill(ctx, '#8ede5f', sx + w + 5, sy - 24, 8, 5, 0.5);
    }
  }

  // ------------------------------------------------------------------ vêtements
  // Chaque fonction dessine un vêtement. `where` = 'head' | 'body' | 'feet' | 'hand'
  var CLOTH_ART = {
    helice: function (ctx, rig, pose, spec, where) {
      if (where !== 'head') return;
      var hx = rig.hx, hy = rig.hy, r = rig.hr;
      ctx.beginPath();
      ctx.ellipse(hx, hy - r * 0.12, r * 1.02, r * 0.98, 0, Math.PI, TAU);
      ctx.fillStyle = '#ff4d6d'; ctx.fill();
      rr(ctx, hx - r * 1.06, hy - r * 0.2, r * 2.12, r * 0.28, 6);
      ctx.fillStyle = '#d63355'; ctx.fill();
      fill(ctx, '#ffd166', hx - r * 0.45, hy - r * 0.62, r * 0.2, r * 0.16);
      // hélice qui tourne
      var a = pose.t * 22;
      capsule(ctx, hx - Math.cos(a) * r * 1.25, hy - r * 1.16 - Math.sin(a) * 4,
        hx + Math.cos(a) * r * 1.25, hy - r * 1.16 + Math.sin(a) * 4, 5, '#5b6472');
      fill(ctx, '#ffd166', hx, hy - r * 1.14, 4, 4);
    },
    magicien: function (ctx, rig, pose, spec, where) {
      if (where !== 'head') return;
      var hx = rig.hx, hy = rig.hy, r = rig.hr;
      var tilt = Math.sin(pose.t * 1.6) * 0.06;
      ctx.save(); ctx.translate(hx, hy - r * 0.6); ctx.rotate(tilt);
      ell(ctx, 0, 0, r * 1.25, r * 0.26); ctx.fillStyle = '#4b3fa8'; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, -r * 0.05);
      ctx.quadraticCurveTo(-r * 0.2, -r * 1.5, r * 0.55, -r * 2.15);
      ctx.quadraticCurveTo(r * 0.15, -r * 1.0, r * 0.78, -r * 0.05);
      ctx.closePath();
      ctx.fillStyle = '#6c5ce7'; ctx.fill();
      ctx.fillStyle = '#ffe66d';
      star(ctx, -r * 0.15, -r * 0.7, r * 0.2, 5); ctx.fill();
      star(ctx, r * 0.28, -r * 1.25, r * 0.14, 5); ctx.fill();
      // les oreilles du lapin dépassent
      var wig = Math.sin(pose.t * 3) * 3;
      fill(ctx, '#fff', r * 0.42 + wig, -r * 2.1, r * 0.16, r * 0.42, 0.25);
      fill(ctx, '#ffc0cb', r * 0.42 + wig, -r * 2.05, r * 0.08, r * 0.28, 0.25);
      ctx.restore();
    },
    passoire: function (ctx, rig, pose, spec, where) {
      if (where !== 'head') return;
      var hx = rig.hx, hy = rig.hy, r = rig.hr;
      ctx.beginPath();
      ctx.ellipse(hx, hy - r * 0.18, r * 1.05, r * 0.95, 0, Math.PI, TAU);
      ctx.fillStyle = '#dfe6ee'; ctx.fill();
      rr(ctx, hx - r * 1.12, hy - r * 0.26, r * 2.24, r * 0.3, 5); ctx.fillStyle = '#c3ceda'; ctx.fill();
      ctx.fillStyle = '#9fb0c0';
      for (var i = 0; i < 7; i++) {
        var a = Math.PI + (i / 6) * Math.PI;
        fill(ctx, '#9fb0c0', hx + Math.cos(a) * r * 0.7, hy - r * 0.2 + Math.sin(a) * r * 0.62, 2.6, 2.6);
      }
      capsule(ctx, hx + r * 0.1, hy - r * 1.1, hx + r * 0.9, hy - r * 1.5, 5, '#c3ceda');
    },
    couronne: function (ctx, rig, pose, spec, where) {
      if (where !== 'head') return;
      var hx = rig.hx, hy = rig.hy, r = rig.hr;
      var y = hy - r * 0.78, w = r * 1.5, h = r * 0.85;
      ctx.beginPath();
      ctx.moveTo(hx - w / 2, y + h * 0.45);
      for (var i = 0; i < 4; i++) {
        var x0 = hx - w / 2 + (i / 4) * w, x1 = hx - w / 2 + ((i + 0.5) / 4) * w, x2 = hx - w / 2 + ((i + 1) / 4) * w;
        ctx.lineTo(x1, y - h * 0.55); ctx.lineTo(x2, y + h * 0.45);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffd43b'; ctx.fill();
      ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 2; ctx.stroke();
      fill(ctx, '#ff5d8f', hx - w * 0.22, y + h * 0.18, r * 0.1, r * 0.1);
      fill(ctx, '#4dabf7', hx + w * 0.02, y + h * 0.18, r * 0.1, r * 0.1);
      fill(ctx, '#69db7c', hx + w * 0.26, y + h * 0.18, r * 0.1, r * 0.1);
    },

    cape: function (ctx, rig, pose, spec, where) {
      if (where !== 'body') return;
      var sx = rig.bx - rig.brx * 0.55, sy = rig.shY;
      var f = 0.5 + pose.speed * 0.5;
      var wob = Math.sin(pose.t * 7) * 7 * f;
      var len = rig.bry * 2.9;
      ctx.beginPath();
      ctx.moveTo(sx - 2, sy - 4);
      ctx.quadraticCurveTo(sx - 34 * f, sy + len * 0.4 + wob, sx - 46 * f + wob * 0.4, sy + len);
      ctx.quadraticCurveTo(sx + 4, sy + len * 1.05, sx + 22, sy + len * 0.75 - wob * 0.3);
      ctx.quadraticCurveTo(sx + 10, sy + len * 0.3, sx + 16, sy - 2);
      ctx.closePath();
      ctx.fillStyle = '#e63946'; ctx.fill();
      ctx.strokeStyle = '#b3212d'; ctx.lineWidth = 2.5; ctx.stroke();
    },
    gilet: function (ctx, rig, pose, spec, where) {
      if (where !== 'body') return;
      var bx = rig.bx, by = rig.by, rx = rig.brx, ry = rig.bry;
      rr(ctx, bx - rx * 0.95, by - ry * 0.85, rx * 1.9, ry * 1.75, ry * 0.5);
      ctx.fillStyle = '#ff9f1c'; ctx.fill();
      ctx.strokeStyle = '#e07b00'; ctx.lineWidth = 2.5; ctx.stroke();
      capsule(ctx, bx - rx * 0.5, by - ry * 0.9, bx + rx * 0.5, by - ry * 0.9, 4, '#e07b00');
      // tête de canard sur le ventre
      fill(ctx, '#ffd43b', bx + rx * 0.1, by + ry * 0.1, rx * 0.36, rx * 0.34);
      ctx.beginPath();
      ctx.moveTo(bx + rx * 0.42, by + ry * 0.06);
      ctx.lineTo(bx + rx * 0.82, by + ry * 0.18);
      ctx.lineTo(bx + rx * 0.42, by + ry * 0.3);
      ctx.closePath(); ctx.fillStyle = '#ff8c42'; ctx.fill();
      fill(ctx, '#2b2118', bx + rx * 0.22, by + ry * 0.0, 2.6, 2.6);
    },
    pull: function (ctx, rig, pose, spec, where) {
      if (where !== 'body') return;
      var bx = rig.bx, by = rig.by, rx = rig.brx, ry = rig.bry;
      rr(ctx, bx - rx * 1.22, by - ry * 1.12, rx * 2.44, ry * 2.4, ry * 0.6);
      ctx.fillStyle = '#7ed957'; ctx.fill();
      ctx.strokeStyle = '#5cb63a'; ctx.lineWidth = 3; ctx.stroke();
      // zigzags de mamie
      ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 3.4; ctx.beginPath();
      for (var i = -2; i <= 2; i++) {
        var y = by + i * ry * 0.42;
        ctx.moveTo(bx - rx, y);
        for (var k = 0; k < 4; k++) {
          ctx.lineTo(bx - rx + (k + 0.5) * rx * 0.5, y + (k % 2 ? 6 : -6));
          ctx.lineTo(bx - rx + (k + 1) * rx * 0.5, y);
        }
      }
      ctx.stroke();
      // ourlet qui traîne
      rr(ctx, bx - rx * 1.24, by + ry * 1.1, rx * 2.48, ry * 0.24, 5);
      ctx.fillStyle = '#5cb63a'; ctx.fill();
    },
    alu: function (ctx, rig, pose, spec, where) {
      if (where !== 'body') return;
      var bx = rig.bx, by = rig.by, rx = rig.brx, ry = rig.bry;
      rr(ctx, bx - rx * 1.0, by - ry * 0.95, rx * 2.0, ry * 1.9, ry * 0.45);
      ctx.fillStyle = '#cfd6de'; ctx.fill();
      ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (var i = 0; i < 6; i++) {
        var a = hash(i * 3.3) * TAU;
        var d = hash(i * 7.7);
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(a) * rx * d * 0.8, by + Math.sin(a) * ry * d * 0.8);
        ctx.lineTo(bx + Math.cos(a + 1) * rx * 0.5, by + Math.sin(a + 1) * ry * 0.5);
        ctx.lineTo(bx + Math.cos(a + 2.2) * rx * 0.35, by + Math.sin(a + 2.2) * ry * 0.4);
        ctx.closePath(); ctx.fill();
      }
      fill(ctx, '#8d99ae', bx + rx * 0.3, by - ry * 0.2, 3, 3);
      fill(ctx, '#8d99ae', bx - rx * 0.4, by + ry * 0.35, 3, 3);
    },

    bottes: function (ctx, rig, pose, spec, where, foot, i) {
      if (where !== 'feet') return;
      var x = foot.x, y = foot.y;
      rr(ctx, x - 12, y - 26, 24, 28, 7); ctx.fillStyle = '#ffd43b'; ctx.fill();
      ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 2.4; ctx.stroke();
      rr(ctx, x - 13, y - 4, 34, 12, 5); ctx.fillStyle = '#ffd43b'; ctx.fill(); ctx.stroke();
      rr(ctx, x - 13, y + 5, 34, 6, 3); ctx.fillStyle = '#8d6a1f'; ctx.fill();
      capsule(ctx, x - 12, y - 20, x + 12, y - 20, 4, '#fff2b0');
    },
    roulettes: function (ctx, rig, pose, spec, where, foot, i) {
      if (where !== 'feet') return;
      var x = foot.x, y = foot.y, spin = pose.phase * 2.4;
      rr(ctx, x - 11, y - 20, 30, 18, 6); ctx.fillStyle = '#4dabf7'; ctx.fill();
      ctx.strokeStyle = '#2b7fc4'; ctx.lineWidth = 2.2; ctx.stroke();
      rr(ctx, x - 12, y - 2, 32, 6, 3); ctx.fillStyle = '#e9ecef'; ctx.fill();
      for (var k = 0; k < 4; k++) {
        var wx = x - 8 + k * 8;
        fill(ctx, '#343a40', wx, y + 6, 5, 5);
        capsule(ctx, wx + Math.cos(spin + k) * 3, y + 6 + Math.sin(spin + k) * 3, wx, y + 6, 1.6, '#adb5bd');
      }
    },
    lapin: function (ctx, rig, pose, spec, where, foot, i) {
      if (where !== 'feet') return;
      var x = foot.x, y = foot.y;
      rr(ctx, x - 12, y - 18, 32, 18, 9); ctx.fillStyle = '#fff5f8'; ctx.fill();
      ctx.strokeStyle = '#e6c3cf'; ctx.lineWidth = 2.2; ctx.stroke();
      // grandes oreilles vers l'avant
      var w = Math.sin(pose.t * 4 + i) * 3;
      fill(ctx, '#fff5f8', x + 18, y - 26 + w, 7, 15, 0.5);
      fill(ctx, '#ffc0cb', x + 18, y - 24 + w, 3.4, 9, 0.5);
      fill(ctx, '#ff8fab', x + 14, y - 12, 3, 2.4);
    },
    palmes: function (ctx, rig, pose, spec, where, foot, i) {
      if (where !== 'feet') return;
      var x = foot.x, y = foot.y;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 16);
      ctx.lineTo(x + 30, y - 8);
      ctx.lineTo(x + 34, y + 6);
      ctx.lineTo(x - 12, y + 6);
      ctx.closePath();
      ctx.fillStyle = '#2ec4b6'; ctx.fill();
      ctx.strokeStyle = '#1a9e92'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.strokeStyle = '#1a9e92'; ctx.lineWidth = 2;
      for (var k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x - 10 + k * 10, y - 14 + k * 2);
        ctx.lineTo(x - 12 + k * 11, y + 5);
        ctx.stroke();
      }
    },

    parapluie: function (ctx, rig, pose, spec, where) {
      if (where !== 'hand') return;
      var hx = rig.hx - rig.brx * 0.2, hy = rig.hy - rig.hr * 2.5 - 18;
      var tilt = Math.sin(pose.t * 1.4) * 0.08 - 0.12;
      capsule(ctx, rig.hands[0].x, rig.hands[0].y, hx + 4, hy + 30, 4, '#8d5b2f');
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt);
      ctx.beginPath();
      ctx.moveTo(-46, 0);
      for (var i = 0; i <= 4; i++) {
        var a = Math.PI + (i / 4) * Math.PI;
        ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 40);
      }
      ctx.closePath();
      ctx.fillStyle = '#ff6b9d'; ctx.fill();
      ctx.strokeStyle = '#d94674'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#fff';
      [[-24, -12], [4, -22], [26, -10], [-8, -6]].forEach(function (d) { fill(ctx, '#fff', d[0], d[1], 5, 5); });
      capsule(ctx, 0, 0, 0, -12, 3.4, '#8d5b2f');
      ctx.restore();
    },
    jetpack: function (ctx, rig, pose, spec, where) {
      if (where !== 'hand') return;
      var bx = rig.bx - rig.brx * 1.15, by = rig.by - 2;
      rr(ctx, bx - 13, by - 24, 26, 48, 12);
      ctx.fillStyle = '#8d5b2f'; ctx.fill();
      ctx.strokeStyle = '#5f3d1e'; ctx.lineWidth = 2.4; ctx.stroke();
      rr(ctx, bx - 13, by - 8, 26, 16, 4); ctx.fillStyle = '#ff6b6b'; ctx.fill();
      rr(ctx, bx - 8, by - 32, 16, 10, 4); ctx.fillStyle = '#e9ecef'; ctx.fill();
      capsule(ctx, bx + 12, by - 26, rig.bx - 4, rig.shY + 2, 4, '#adb5bd');
      // flammes
      var f = 0.5 + (pose.air > 0.2 ? 0.9 : 0) + (pose.boost ? 1.2 : 0);
      for (var i = 0; i < 2; i++) {
        var fx = bx - 5 + i * 10, fl = (16 + Math.sin(pose.t * 30 + i) * 7) * f;
        ctx.beginPath();
        ctx.moveTo(fx - 5, by + 24);
        ctx.quadraticCurveTo(fx, by + 24 + fl, fx + 5, by + 24);
        ctx.closePath();
        ctx.fillStyle = i ? '#ffd43b' : '#ff922b'; ctx.fill();
      }
    },
    epuisette: function (ctx, rig, pose, spec, where) {
      if (where !== 'hand') return;
      var h = rig.hands[1] || rig.hands[0];
      var tx = h.x + 26, ty = h.y - 34, wob = Math.sin(pose.t * 3) * 5;
      capsule(ctx, h.x, h.y, tx, ty, 4.5, '#a5744a');
      ctx.save(); ctx.translate(tx, ty + wob * 0.4); ctx.rotate(0.2);
      ell(ctx, 0, 0, 17, 13); ctx.strokeStyle = '#5b6472'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (var i = -2; i <= 2; i++) { ctx.moveTo(i * 6, -12); ctx.lineTo(i * 7, 16); }
      for (var k = 0; k < 3; k++) { ctx.moveTo(-17, -6 + k * 7); ctx.lineTo(17, -4 + k * 7); }
      ctx.stroke();
      ctx.restore();
    },
    ballon: function (ctx, rig, pose, spec, where) {
      if (where !== 'hand') return;
      var h = rig.hands[1] || rig.hands[0];
      var bx = h.x + 20, by = h.y - 74 + Math.sin(pose.t * 2.2) * 5;
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.quadraticCurveTo(bx - 8, by + 40, bx, by + 20); ctx.stroke();
      ell(ctx, bx, by, 21, 26, 0.1); ctx.fillStyle = '#ff5d8f'; ctx.fill();
      ctx.strokeStyle = '#d63b6c'; ctx.lineWidth = 2.2; ctx.stroke();
      fill(ctx, 'rgba(255,255,255,.6)', bx - 7, by - 9, 5, 8, -0.4);
      ctx.beginPath(); ctx.moveTo(bx - 4, by + 25); ctx.lineTo(bx + 4, by + 25); ctx.lineTo(bx, by + 31); ctx.closePath();
      ctx.fillStyle = '#d63b6c'; ctx.fill();
    },
  };

  // pieds nus selon l'espèce
  function drawBareFeet(ctx, spec, foot, i, pose) {
    var p = spec.palette;
    if (spec.species === 'chicken') {
      ctx.strokeStyle = '#ffab2e'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(foot.x, foot.y - 6); ctx.lineTo(foot.x + 4, foot.y + 2);
      ctx.moveTo(foot.x + 4, foot.y + 2); ctx.lineTo(foot.x - 5, foot.y + 4);
      ctx.moveTo(foot.x + 4, foot.y + 2); ctx.lineTo(foot.x + 12, foot.y + 4);
      ctx.moveTo(foot.x + 4, foot.y + 2); ctx.lineTo(foot.x + 5, foot.y + 7);
      ctx.stroke();
      return;
    }
    ell(ctx, p.skinDark, foot.x + 3, foot.y - 4, 11, 7, 0);
    ell(ctx, shade(p.skinDark, 0.2), foot.x + 3, foot.y - 6, 8, 4, 0);
    if (spec.species === 'cat') {
      for (var t = 0; t < 3; t++) fill(ctx, p.skinDark, foot.x - 4 + t * 6, foot.y - 1, 2.6, 2.6);
    }
  }

  // ------------------------------------------------------------------ le runner
  // Dessine un personnage complet, pieds à l'origine (0,0), regardant à droite.
  CF.draw = CF.draw || {};

  CF.draw.runner = function (ctx, charId, outfit, pose, scale) {
    var spec = typeof charId === 'string' ? CF.CHARACTERS[charId] : charId;
    if (!spec) return;
    var S = SPECIES[spec.species] || SPECIES.cat;
    pose = pose || defaultPose();
    var p = spec.palette;
    var sk = p.skin, dk = shade(sk, -0.22), lt = shade(sk, 0.18);
    scale = scale || 1;

    ctx.save();
    ctx.scale(scale, scale);

    // inclinaison (course, trébuchement) et écrasement à l'atterrissage
    var sq = pose.squash || 0;
    ctx.rotate((pose.lean || 0) + (pose.stumble || 0) * (0.5 + Math.sin(pose.t * 18) * 0.25));
    ctx.translate(0, 0);
    ctx.scale(1 + sq * 0.16 - (pose.air > 0.4 ? 0.04 : 0), 1 - sq * 0.2 + (pose.air > 0.4 ? 0.06 : 0));

    var bob = pose.onGround ? Math.abs(Math.sin(pose.phase)) * 3 : 0;
    ctx.translate(0, -bob);

    var rig = {
      bx: 0, by: S.bodyY + (S.headless ? 0 : 0), brx: S.bodyRx, bry: S.bodyRy,
      hx: 3, hy: S.headY, hr: S.headR,
      shY: S.shY, hipY: S.hipY,
      feet: [legPose(S, 0, pose), legPose(S, 1, pose)],
      hands: [armPose(S, 0, pose), armPose(S, 1, pose)],
    };

    // --- queue (derrière) ---
    if (spec.species === 'cat') {
      var w = Math.sin(pose.t * 5) * 8;
      bend(ctx, -S.bodyRx * 0.7, S.bodyY + 6, -S.bodyRx * 1.5, S.bodyY - 6 + w, -S.bodyRx * 1.5 + w * 0.6, S.bodyY - 30 + w, 9, dk);
      bend(ctx, -S.bodyRx * 0.7, S.bodyY + 6, -S.bodyRx * 1.5, S.bodyY - 6 + w, -S.bodyRx * 1.5 + w * 0.6, S.bodyY - 30 + w, 4, lt);
    }
    if (spec.species === 'chicken') {
      for (var f = 0; f < 3; f++) {
        var ang = -0.5 - f * 0.35 + Math.sin(pose.t * 3) * 0.06;
        ctx.save(); ctx.translate(-S.bodyRx * 0.85, S.bodyY - 4); ctx.rotate(ang);
        ell(ctx, -10, 0, 13, 5); ctx.fillStyle = f % 2 ? '#ffe9b8' : '#fff'; ctx.fill();
        ctx.restore();
      }
    }

    // --- cape (derrière le corps) ---
    if (outfit && outfit.torse === 'cape') CLOTH_ART.cape(ctx, rig, pose, spec, 'body');
    if (outfit && outfit.main === 'jetpack') CLOTH_ART.jetpack(ctx, rig, pose, spec, 'hand');

    // --- jambe + bras ARRIÈRE ---
    var backFoot = rig.feet[0], frontFoot = rig.feet[1];
    var backHand = rig.hands[0], frontHand = rig.hands[1];

    if (S.wings) {
      var wa = Math.sin(pose.phase + Math.PI) * 0.6 - pose.flap * 1.1;
      ctx.save(); ctx.translate(-4, S.shY); ctx.rotate(wa);
      ell(ctx, -8, 8, 14, 9, -0.5); ctx.fillStyle = dk; ctx.fill();
      ctx.restore();
    } else {
      bend(ctx, -2, S.shY, backHand.ex - 4, backHand.ey, backHand.x - 4, backHand.y, S.arm * 0.34, dk);
      fill(ctx, dk, backHand.x - 4, backHand.y, S.arm * 0.2, S.arm * 0.2);
    }
    bend(ctx, 0, S.hipY, backFoot.kx - 3, backFoot.ky, backFoot.x - 3, backFoot.y, S.leg * 0.36, dk);
    drawFoot(ctx, spec, outfit, rig, pose, { x: backFoot.x - 3, y: backFoot.y }, 0, true);

    // --- corps ---
    if (S.headless) {
      // patate bosselée
      ctx.beginPath();
      for (var a2 = 0; a2 <= 32; a2++) {
        var ang2 = (a2 / 32) * TAU;
        var lump = 1 + Math.sin(ang2 * 3.2 + 0.6) * 0.07 + Math.sin(ang2 * 5.1) * 0.04;
        var px = rig.bx + Math.cos(ang2) * S.bodyRx * lump;
        var py = rig.by + Math.sin(ang2) * S.bodyRy * lump;
        if (a2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = sk; ctx.fill();
      ctx.strokeStyle = shade(sk, -0.3); ctx.lineWidth = 2.5; ctx.stroke();
      fill(ctx, shade(sk, -0.18), rig.bx - 12, rig.by - 8, 4, 3);
      fill(ctx, shade(sk, -0.18), rig.bx + 14, rig.by + 10, 3.4, 2.6);
      drawPotatoHead(ctx, spec, rig, pose);
    } else {
      fill(ctx, sk, rig.bx, rig.by, S.bodyRx, S.bodyRy);
      fill(ctx, p.belly, rig.bx + 2, rig.by + S.bodyRy * 0.22, S.bodyRx * 0.66, S.bodyRy * 0.62);
      fill(ctx, lt, rig.bx - S.bodyRx * 0.35, rig.by - S.bodyRy * 0.5, S.bodyRx * 0.4, S.bodyRy * 0.28);
    }

    // tutu de Bébert (fait partie du personnage)
    if (S.tutu) {
      ctx.beginPath();
      ctx.moveTo(-S.bodyRx * 1.05, S.hipY + 2);
      for (var q = 0; q <= 8; q++) {
        var xx = -S.bodyRx * 1.05 + (q / 8) * S.bodyRx * 2.1;
        ctx.lineTo(xx, S.hipY + 18 + (q % 2 ? 7 : 0) + Math.sin(pose.t * 6 + q) * 2);
      }
      ctx.lineTo(S.bodyRx * 1.05, S.hipY + 2);
      ctx.closePath();
      ctx.fillStyle = '#ff9ecd'; ctx.fill();
      ctx.strokeStyle = '#e87bb0'; ctx.lineWidth = 2; ctx.stroke();
    }

    // --- vêtement du torse ---
    if (outfit && outfit.torse && CLOTH_ART[outfit.torse] && outfit.torse !== 'cape') {
      CLOTH_ART[outfit.torse](ctx, rig, pose, spec, 'body');
    }

    // --- tête ---
    drawHead(ctx, S, spec, rig, pose, outfit);

    // --- jambe + bras AVANT ---
    if (S.wings) {
      var wa2 = Math.sin(pose.phase) * 0.6 - pose.flap * 1.1;
      ctx.save(); ctx.translate(4, S.shY); ctx.rotate(wa2);
      ell(ctx, 8, 8, 15, 10, 0.5); ctx.fillStyle = sk; ctx.fill();
      ctx.strokeStyle = shade(sk, -0.2); ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    } else {
      bend(ctx, 2, S.shY, frontHand.ex, frontHand.ey, frontHand.x, frontHand.y, S.arm * 0.34, sk);
      fill(ctx, sk, frontHand.x, frontHand.y, S.arm * 0.21, S.arm * 0.21);
    }
    bend(ctx, 2, S.hipY, frontFoot.kx, frontFoot.ky, frontFoot.x, frontFoot.y, S.leg * 0.36, sk);
    drawFoot(ctx, spec, outfit, rig, pose, frontFoot, 1, false);

    // --- accessoire tenu ---
    if (outfit && outfit.main && CLOTH_ART[outfit.main] && outfit.main !== 'jetpack') {
      CLOTH_ART[outfit.main](ctx, rig, pose, spec, 'hand');
    }

    // --- traînées de super vitesse ---
    if (pose.boost) {
      ctx.globalAlpha = 0.5;
      for (var i2 = 0; i2 < 4; i2++) {
        var yy = -20 - i2 * 22 + Math.sin(pose.t * 20 + i2) * 4;
        capsule(ctx, -S.bodyRx - 12 - i2 * 8, yy, -S.bodyRx - 46 - i2 * 14, yy, 4 - i2 * 0.6, i2 % 2 ? '#ffd43b' : '#ff922b');
      }
      ctx.globalAlpha = 1;
    }

    // petites étoiles quand on est sonné
    if (pose.hurt) {
      for (var s2 = 0; s2 < 3; s2++) {
        var ang3 = pose.t * 5 + s2 * (TAU / 3);
        var sx = rig.hx + Math.cos(ang3) * (rig.hr + 16), sy = rig.hy - rig.hr - 8 + Math.sin(ang3) * 9;
        star(ctx, sx, sy, 5.5, 5);
        ctx.fillStyle = '#ffd43b'; ctx.fill();
      }
    }

    ctx.restore();
  };

  function drawFoot(ctx, spec, outfit, rig, pose, foot, i, back) {
    var id = outfit && outfit.pieds;
    if (id && CLOTH_ART[id]) {
      ctx.save();
      if (back) ctx.globalAlpha = 0.82;
      CLOTH_ART[id](ctx, rig, pose, spec, 'feet', foot, i);
      ctx.restore();
    } else {
      ctx.save();
      if (back) ctx.globalAlpha = 0.82;
      drawBareFeet(ctx, spec, foot, i, pose);
      ctx.restore();
    }
  }

  CF.draw.defaultPose = defaultPose;

  // ------------------------------------------------------------------ portrait
  // Petite tête pour les marqueurs du classement (canvas dédié).
  CF.draw.face = function (ctx, charId, size, outfit) {
    var spec = CF.CHARACTERS[charId];
    if (!spec) return;
    var S = SPECIES[spec.species];
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    // la tête remplit bien le petit rond du classement
    var k = size / (S.headless ? 62 : 52);
    ctx.translate(size / 2, size / 2);
    ctx.scale(k, k);
    var rig = {
      bx: 0, by: 0, brx: S.bodyRx, bry: S.bodyRy,
      hx: 0, hy: 0, hr: S.headless ? S.bodyRx * 0.7 : S.headR,
      shY: S.shY, hipY: S.hipY, feet: [], hands: [{ x: -10, y: 0 }, { x: 10, y: 0 }],
    };
    var pose = defaultPose();
    if (S.headless) {
      fill(ctx, spec.palette.skin, 0, 0, S.bodyRx, S.bodyRy);
      drawPotatoHead(ctx, spec, { bx: 0, by: 4, brx: S.bodyRx, bry: S.bodyRy }, pose);
    } else {
      drawHead(ctx, S, spec, rig, pose, outfit);
    }
    ctx.restore();
  };

  // ------------------------------------------------------------------ outils UI
  CF.gfx = { rr: rr, ell: ell, fill: fill, capsule: capsule, bend: bend, star: star, hash: hash, lerp: lerp, clamp: clamp, shade: shade, outline: outline, TAU: TAU, SPECIES: SPECIES };
})(window.CF);
