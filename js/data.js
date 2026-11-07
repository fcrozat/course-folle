/* ============================================================================
   LA COURSE FOLLE — données du jeu (personnages, vêtements, décors, obstacles)
   ============================================================================ */
window.CF = window.CF || {};

(function (CF) {
  'use strict';

  // ---------------------------------------------------------------- réglages
  CF.COURSE = {
    meters: 600,        // longueur de la course
    zoneCount: 4,       // nombre de décors traversés
    pxPerMeter: 50,     // conversion monde <-> mètres
    baseSpeed: 400,     // px/s de référence
    boostCandies: 12,   // bonbons pour remplir la jauge de super vitesse
    boostTime: 4.0,     // secondes de super vitesse
    shieldCost: 12,     // bonbons pour recharger un bouclier
  };

  // ------------------------------------------------------------- personnages
  // speed/jump/gravity sont des multiplicateurs ; « talent » = pouvoir propre.
  CF.CHARACTERS = {
    momo: {
      id: 'momo', name: 'Momo', species: 'cat',
      title: 'le chat-chaussette',
      blurb: 'Il dort dans une chaussette et court comme un éclair mou.',
      talent: { id: 'soft', name: 'Retombe sur ses pattes', desc: 'Ses trébuchements sont deux fois moins longs.' },
      speed: 1.00, jump: 1.02, gravity: 1.00, magnet: 1.0, candy: 1.0,
      palette: { skin: '#f6a83c', skinDark: '#d9862a', belly: '#ffe6bd', accent: '#ff7a59', eye: '#3b2a20' },
    },
    bebert: {
      id: 'bebert', name: 'Bébert', species: 'elephant',
      title: "l'éléphant en tutu",
      blurb: 'Trois tonnes de grâce. Le tutu est obligatoire, c’est la loi.',
      talent: { id: 'stomp', name: 'Pieds très lourds', desc: 'En retombant, il écrase les obstacles devant lui.' },
      speed: 0.95, jump: 0.88, gravity: 1.10, magnet: 1.0, candy: 1.0,
      palette: { skin: '#95a3d6', skinDark: '#7280b8', belly: '#c7d0f2', accent: '#ff6fae', eye: '#2a2438' },
    },
    kiki: {
      id: 'kiki', name: 'Kiki', species: 'chicken',
      title: 'la poulette fusée',
      blurb: 'Elle ne vole pas, elle « tombe avec style ».',
      talent: { id: 'flap', name: 'Bat des ailes', desc: 'Reste appuyé en l’air pour monter encore un peu.' },
      speed: 1.12, jump: 1.00, gravity: 0.97, magnet: 1.0, candy: 1.0,
      palette: { skin: '#fff2cf', skinDark: '#f0d9a4', belly: '#fffaf0', accent: '#ff4d4d', eye: '#3a2a1a' },
    },
    patate: {
      id: 'patate', name: 'Prof. Patate', species: 'potato',
      title: 'la patate savante',
      blurb: 'A inventé le calcul des bonbons. Il a trois doctorats en sieste.',
      talent: { id: 'magnet', name: 'Aimant à bonbons', desc: 'Les bonbons arrivent de très loin, et valent double.' },
      speed: 0.98, jump: 0.96, gravity: 1.00, magnet: 2.8, candy: 2.0,
      palette: { skin: '#cf9a58', skinDark: '#a97638', belly: '#e7c694', accent: '#7ed957', eye: '#33241a' },
    },
  };
  CF.CHARACTER_ORDER = ['momo', 'bebert', 'kiki', 'patate'];

  // ---------------------------------------------------------------- vêtements
  CF.SLOTS = [
    { id: 'tete',  name: 'Tête',    icon: '🎩', none: 'Tête nue' },
    { id: 'torse', name: 'Torse',   icon: '👕', none: 'Rien du tout' },
    { id: 'pieds', name: 'Pieds',   icon: '👟', none: 'Pieds nus' },
    { id: 'main',  name: 'Accessoire', icon: '🎈', none: 'Mains vides' },
  ];

  // mods : multiplicateurs additifs sur speed/jump/gravity + pouvoirs
  CF.CLOTHES = {
    // ---- tête
    helice: {
      id: 'helice', slot: 'tete', name: 'Casque à hélice', icon: '🚁',
      desc: 'L’hélice fait « prout-prout » et hop, un deuxième saut en l’air !',
      mods: { speed: -0.03, doubleJump: true },
    },
    magicien: {
      id: 'magicien', slot: 'tete', name: 'Chapeau de magicien', icon: '🎩',
      desc: 'Il y a un lapin dedans. Le lapin donne des conseils de saut.',
      mods: { jump: 0.10, gravity: -0.05 },
    },
    passoire: {
      id: 'passoire', slot: 'tete', name: 'Passoire à spaghetti', icon: '🍝',
      desc: 'Protège des chocs et des idées trop cuites.',
      mods: { speed: -0.05, shield: 1 },
    },
    couronne: {
      id: 'couronne', slot: 'tete', name: 'Couronne en carton', icon: '👑',
      desc: 'Les bonbons arrivent en procession royale.',
      mods: { jump: -0.05, candy: 1.0 },
    },

    // ---- torse
    cape: {
      id: 'cape', slot: 'torse', name: 'Cape de super-héros', icon: '🦸',
      desc: 'Elle claque au vent et transforme les chutes en plané.',
      mods: { gravity: -0.24, speed: -0.02 },
    },
    gilet: {
      id: 'gilet', slot: 'torse', name: 'Gilet canard', icon: '🦆',
      desc: 'Un canard gonflable qui fait « boing » à l’atterrissage.',
      mods: { gravity: -0.08, speed: -0.04, bounce: true },
    },
    pull: {
      id: 'pull', slot: 'torse', name: 'Pull de mamie', icon: '🧶',
      desc: 'Il gratte, il traîne par terre, mais il porte chance.',
      mods: { speed: -0.10, jump: 0.18, gravity: -0.08 },
    },
    alu: {
      id: 'alu', slot: 'torse', name: 'Armure en papier alu', icon: '🛡️',
      desc: 'Zéro bobo. Beaucoup de bruit dans les escaliers.',
      mods: { jump: -0.07, shield: 1 },
    },

    // ---- pieds
    bottes: {
      id: 'bottes', slot: 'pieds', name: 'Bottes géantes', icon: '🥾',
      desc: 'Tellement grandes qu’elles rebondissent toutes seules.',
      mods: { jump: 0.05, speed: -0.07, bounce: true },
    },
    roulettes: {
      id: 'roulettes', slot: 'pieds', name: 'Patins à roulettes', icon: '🛼',
      desc: 'Ça va très vite. Ça freine beaucoup moins bien.',
      mods: { speed: 0.18, jump: -0.10, gravity: 0.05 },
    },
    lapin: {
      id: 'lapin', slot: 'pieds', name: 'Chaussons lapin', icon: '🐰',
      desc: 'Deux grandes oreilles aux pieds : pratique pour le double saut.',
      mods: { jump: 0.02, speed: -0.02, doubleJump: true },
    },
    palmes: {
      id: 'palmes', slot: 'pieds', name: 'Palmes de plongée', icon: '🩱',
      desc: 'Parfaites pour nager dans l’air, paraît-il.',
      mods: { gravity: -0.14, jump: 0.08, speed: -0.05 },
    },

    // ---- accessoire
    parapluie: {
      id: 'parapluie', slot: 'main', name: 'Parapluie à pois', icon: '☂️',
      desc: 'Il pleut des confettis, jamais de l’eau.',
      mods: { gravity: -0.30, speed: -0.10 },
    },
    jetpack: {
      id: 'jetpack', slot: 'main', name: 'Jetpack à soda', icon: '🚀',
      desc: 'Secouer avant décollage. Ne pas boire après.',
      mods: { speed: 0.22, jump: -0.08, gravity: 0.06 },
    },
    epuisette: {
      id: 'epuisette', slot: 'main', name: 'Épuisette à papillons', icon: '🦋',
      desc: 'Attrape les bonbons qui passaient par là.',
      mods: { magnet: 2.4, candy: 0.5 },
    },
    ballon: {
      id: 'ballon', slot: 'main', name: 'Ballon gonflable', icon: '🎈',
      desc: 'Tire le champion vers le haut, comme un bouchon dans l’eau.',
      mods: { gravity: -0.20, jump: -0.04, speed: -0.04 },
    },
  };

  // ------------------------------------------------------------------ décors
  // gravity/speed : multiplicateurs appliqués PENDANT la zone.
  CF.ZONES = {
    jardin: {
      id: 'jardin', name: 'Le Jardin Fou', icon: '🌼',
      message: 'ZOU ! Le Jardin Fou !',
      gravity: 1.00, speed: 1.00, candyRate: 1.0, air: true,
      sky: ['#7fd4ff', '#dff6ff'], sun: '#fff27a',
      ground: { top: '#7bc94a', body: '#8b5a2b', bodyDark: '#6f4520', line: '#5aa537' },
      hills: { color: '#a8dc7a', color2: '#8ed063' },
      decorFar: ['hedge', 'tree'], decorMid: ['flower', 'mushroom', 'bush', 'snailHouse'],
      obstacles: {
        taupe:    { art: 'taupe',    w: 56, h: 40, ground: true },
        gnome:    { art: 'gnome',    w: 46, h: 64, ground: true },
        tuyau:    { art: 'tuyau',    w: 74, h: 34, ground: true },
        tondeuse: { art: 'tondeuse', w: 96, h: 54, ground: true },
        abeille:  { art: 'abeille',  w: 54, h: 38, ground: false },
      },
    },
    cuisine: {
      id: 'cuisine', name: 'La Cuisine Géante', icon: '🍳',
      message: 'ZOU ! La Cuisine Géante !',
      gravity: 1.00, speed: 1.06, candyRate: 1.1, air: true,
      sky: ['#ffd9a0', '#fff2dd'], sun: '#fff6c9',
      ground: { top: '#f2f2f2', body: '#d9534f', bodyDark: '#b93c39', line: '#e8e8e8', checker: true },
      hills: { color: '#f7c98b', color2: '#eab473' },
      decorFar: ['shelf', 'window'], decorMid: ['jar', 'cup', 'crumb', 'spoon'],
      obstacles: {
        banane:      { art: 'banane',      w: 70, h: 24, ground: true },
        grillepain:  { art: 'grillepain',  w: 58, h: 58, ground: true },
        brique:      { art: 'brique',      w: 46, h: 72, ground: true },
        casserole:   { art: 'casserole',   w: 88, h: 58, ground: true },
        tartine:     { art: 'tartine',     w: 60, h: 36, ground: false },
      },
    },
    lune: {
      id: 'lune', name: 'La Lune en Fromage', icon: '🧀',
      message: 'ZOU ! Sur la Lune en fromage !',
      gravity: 0.55, speed: 0.98, candyRate: 1.0, air: false,
      sky: ['#1b1b46', '#4b3d8f'], sun: '#fdfbe6', stars: true,
      ground: { top: '#f6d365', body: '#e0b74a', bodyDark: '#c39a34', line: '#d9ae41', holes: true },
      hills: { color: '#3b3470', color2: '#2c2757' },
      decorFar: ['crater', 'planet'], decorMid: ['cheese', 'flag', 'star', 'rock'],
      obstacles: {
        cratere:  { art: 'cratere',  w: 96, h: 26, ground: true },
        fromage:  { art: 'fromage',  w: 62, h: 54, ground: true },
        fusee:    { art: 'fusee',    w: 54, h: 78, ground: true },
        vache:    { art: 'vache',    w: 84, h: 62, ground: true },
      },
    },
    piscine: {
      id: 'piscine', name: 'Le Fond de la Piscine', icon: '🌊',
      message: 'GLOU ! Le Fond de la Piscine !',
      gravity: 0.74, speed: 0.90, candyRate: 1.15, air: true,
      sky: ['#1a7fbf', '#63d2f0'], sun: '#c9f2ff', underwater: true,
      ground: { top: '#8fd9e8', body: '#2f7fae', bodyDark: '#256a92', line: '#79cfe0', tiles: true },
      hills: { color: '#2f93c6', color2: '#2482b3' },
      decorFar: ['coral', 'tilesWall'], decorMid: ['bubble', 'algae', 'fish', 'starfishDeco'],
      obstacles: {
        bouee:   { art: 'bouee',   w: 66, h: 58, ground: true },
        seau:    { art: 'seau',    w: 50, h: 46, ground: true },
        crabe:   { art: 'crabe',   w: 64, h: 40, ground: true },
        meduse:  { art: 'meduse',  w: 58, h: 56, ground: false },
      },
    },
    bonbons: {
      id: 'bonbons', name: 'Le Pays des Bonbons', icon: '🍭',
      message: 'MIAM ! Le Pays des Bonbons !',
      gravity: 1.00, speed: 1.02, candyRate: 1.6, air: true,
      sky: ['#ffb3d9', '#ffe6f5'], sun: '#fff0a8',
      ground: { top: '#ffd6ec', body: '#c98fd6', bodyDark: '#a86fba', line: '#ffc2e2', stripes: true },
      hills: { color: '#ffc7e6', color2: '#ffb0da' },
      decorFar: ['candyCane', 'lollipopTree'], decorMid: ['gumdrop', 'candy', 'icecream', 'donut'],
      obstacles: {
        sucette:   { art: 'sucette',   w: 46, h: 80, ground: true },
        gateau:    { art: 'gateau',    w: 90, h: 58, ground: true },
        chocolat:  { art: 'chocolat',  w: 58, h: 68, ground: true },
        glue:      { art: 'glue',      w: 78, h: 26, ground: true },
        frelon:    { art: 'frelon',    w: 56, h: 38, ground: false },
      },
    },
  };
  CF.ZONE_ORDER = ['jardin', 'cuisine', 'lune', 'piscine', 'bonbons'];

  // --------------------------------------------------------- calcul des stats
  var BASE = { speed: 1, jump: 1, gravity: 1, magnet: 1, candy: 1 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Rassemble personnage + tenue en un objet de stats exploitable par le jeu.
  CF.buildStats = function (charId, outfit) {
    var c = CF.CHARACTERS[charId] || CF.CHARACTERS.momo;
    var s = {
      speed: c.speed, jump: c.jump, gravity: c.gravity,
      magnet: c.magnet || BASE.magnet, candy: c.candy || BASE.candy,
      doubleJump: false, shield: 0, bounce: false,
    };
    var items = [];

    for (var i = 0; i < CF.SLOTS.length; i++) {
      var slot = CF.SLOTS[i].id;
      var id = outfit && outfit[slot];
      if (!id || !CF.CLOTHES[id]) continue;
      var it = CF.CLOTHES[id];
      items.push(it);
      var m = it.mods || {};
      s.speed += m.speed || 0;
      s.jump += m.jump || 0;
      s.gravity += m.gravity || 0;
      s.magnet *= m.magnet || 1;
      s.candy += m.candy || 0;
      if (m.doubleJump) s.doubleJump = true;
      if (m.shield) s.shield += m.shield;
      if (m.bounce) s.bounce = true;
    }

    // talents propres au personnage
    var t = c.talent;
    if (t.id === 'stomp') { s.stomp = 120; }
    if (t.id === 'flap') { s.flap = 0.30; s.jump += 0.02; }
    if (t.id === 'magnet') { s.magnet *= 1.2; }

    s.speed = clamp(s.speed, 0.72, 1.45);
    s.jump = clamp(s.jump, 0.86, 1.30);
    s.gravity = clamp(s.gravity, 0.45, 1.30);
    s.magnet = clamp(s.magnet, 0.5, 7);
    s.candy = clamp(s.candy, 0.6, 4);
    s.items = items;
    s.char = c;
    return s;
  };

  // Barres affichées dans le vestiaire (0..1), lisibles pour un enfant.
  CF.statBars = function (s) {
    function norm(v, a, b) { return clamp((v - a) / (b - a), 0.04, 1); }
    var height = (s.jump * s.jump) / s.gravity;   // hauteur de saut relative
    var air = 1 / s.gravity;                      // temps passé en l'air
    return [
      { key: 'speed', label: 'Vitesse', icon: '💨', v: norm(s.speed, 0.72, 1.45) },
      { key: 'jump', label: 'Saut', icon: '🦘', v: norm(Math.sqrt(height), 0.8, 1.85) },
      { key: 'float', label: 'Légèreté', icon: '🎈', v: norm(air, 0.77, 2.2) },
      { key: 'candy', label: 'Bonbons', icon: '🍬', v: norm(Math.sqrt(s.candy * s.magnet), 0.9, 5.2) },
    ];
  };

  CF.statPowers = function (s) {
    var p = [];
    if (s.doubleJump) p.push({ icon: '🚁', label: 'Double saut' });
    if (s.shield) p.push({ icon: '🛡️', label: 'Bouclier' });
    if (s.bounce) p.push({ icon: '🦆', label: 'Rebond' });
    if (s.stomp) p.push({ icon: '🐘', label: 'Écrasement' });
    if (s.flap) p.push({ icon: '🐔', label: "Battements d'ailes" });
    if (s.magnet >= 2) p.push({ icon: '🧲', label: 'Aimant à bonbons' });
    return p;
  };

  // ------------------------------------------------------- tenues au hasard
  function pick(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; }

  CF.randomOutfit = function (rnd) {
    var o = {};
    CF.SLOTS.forEach(function (slot) {
      var ids = Object.keys(CF.CLOTHES).filter(function (k) { return CF.CLOTHES[k].slot === slot.id; });
      // une chance sur quatre de rester « nu » pour ce slot
      o[slot.id] = (rnd || Math.random)() < 0.25 ? null : pick(ids, rnd);
    });
    return o;
  };

  // Tirage des décors d'une course : 4 zones différentes, ordre aléatoire,
  // toujours fini par un décor différent du premier (joli à l'arrivée).
  CF.pickZones = function (rnd) {
    rnd = rnd || Math.random;
    var pool = CF.ZONE_ORDER.slice();
    var out = [];
    while (out.length < CF.COURSE.zoneCount && pool.length) {
      out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    }
    return out;
  };

  // ------------------------------------------------------------- commentaires
  CF.resultLines = {
    win: [
      'IMBATTABLE ! Même les escargots applaudissent.',
      'Première place ! Le tutu de Bébert en est tout froissé.',
      'VICTOIRE ! Tu peux garder ta tenue porte-bonheur.',
    ],
    close: [
      'Presque ! Il a manqué trois bonbons et un petit saut.',
      'Si près du podium que tu sens encore le vent de la course !',
      'Pas mal du tout ! Retente avec des bottes géantes.',
    ],
    last: [
      'Dernière place... mais quelle belle chute, franchement.',
      'Les escargots te proposent un entraînement demain matin.',
      'Tu as perdu, mais ta tenue était la plus belle. Ça compte.',
    ],
  };

  CF.utils = { clamp: clamp, pick: pick };
})(window.CF);
