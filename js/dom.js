/* ============================================================================
   DOM — trois petits helpers partagés par les écrans (pas d'innerHTML).
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function into(parent) {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  // cinq petits points pour lire un niveau d'un coup d'œil
  function dots(v, max) {
    max = max || 5;
    var n = Math.max(1, Math.round(v * max));
    var box = el('span', 'dots');
    for (var i = 0; i < max; i++) box.appendChild(el('i', 'dot' + (i < n ? ' on' : '')));
    return box;
  }

  // canvas net quel que soit l'écran (retina inclus)
  function canvas2d(canvas) {
    var dpr = window.devicePixelRatio || 1;
    if (canvas._dpr !== dpr || !canvas._w) {
      canvas._w = canvas.width; canvas._h = canvas.height; canvas._dpr = dpr;
      canvas.width = canvas._w * dpr;
      canvas.height = canvas._h * dpr;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: canvas._w, h: canvas._h };
  }

  function on(node, ev, fn, opt) { if (node) node.addEventListener(ev, fn, opt); }

  CF.dom = { el: el, clear: clear, into: into, dots: dots, canvas2d: canvas2d, on: on };
})(window.CF);
