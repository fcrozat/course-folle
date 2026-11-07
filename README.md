# 🏁 La Course Folle

Un petit jeu de course pour enfant (pensé pour ~8 ans) : on habille un champion
loufoque, puis on le fait sauter par-dessus des bêtises dans des décors qui
changent en pleine course. **Un seul bouton** : appuyer pour sauter.

- **100 % autonome** : un seul dossier, aucune dépendance, aucune image, aucun
  son téléchargé (tout est dessiné au canvas et généré en WebAudio).
- **Fonctionne en ouvrant simplement `index.html`** (double-clic), ou servi via
  n'importe quel serveur statique.
- **Cibles** : tablette Android (tactile) et PC (Firefox / Chrome), paysage ou
  portrait.

## Lancer le jeu

```bash
# le plus simple : ouvrir le fichier
xdg-open index.html          # ou double-cliquer dessus

# ou via un petit serveur (recommandé pour le développement)
python3 -m http.server 8000
# puis http://localhost:8000
```

Aucune étape de build : ce sont des scripts classiques (`<script src=…>`), donc
`file://` fonctionne aussi (pas de modules ES, pas de `fetch`).

## Comment on joue

| Geste | Effet |
| --- | --- |
| Toucher l'écran / `Espace` / `↑` / `W` | sauter |
| Rester appuyé | saut un peu plus haut (et Kiki bat des ailes) |
| Relâcher tôt | saut un peu plus bas |
| `Échap` / `P` ou bouton ⏸ | pause |

- Ramasser **12 bonbons** déclenche la **SUPER VITESSE** (invincible + turbo).
- Toucher un obstacle fait **trébucher** (on ralentit, les autres passent) —
  jamais de « game over » : la course va toujours au bout.
- La course traverse **4 décors tirés au hasard** parmi 5, chacun avec sa
  physique : sur la **Lune** on saute très haut, au **fond de la piscine** on
  flotte, etc.

## Le vestiaire (le cœur du jeu)

4 champions, chacun avec un **talent** propre :

| Champion | Talent |
| --- | --- |
| Momo, le chat-chaussette | trébuche deux fois moins longtemps |
| Bébert, l'éléphant en tutu | écrase les obstacles en retombant |
| Kiki, la poulette fusée | bat des ailes si on reste appuyé en l'air |
| Prof. Patate | aimante les bonbons, qui valent double |

…et **16 vêtements** répartis sur 4 emplacements (tête / torse / pieds /
accessoire). Chaque vêtement modifie de vraies statistiques et ajoute un pouvoir
visible sur le personnage :

- **Casque à hélice**, **chaussons lapin** → double saut
- **Cape**, **parapluie**, **ballon**, **palmes** → chute plus lente (on plane)
- **Patins à roulettes**, **jetpack à soda** → plus vite (mais saut plus court)
- **Passoire**, **armure en papier alu** → bouclier (absorbe un choc)
- **Bottes géantes**, **gilet canard** → rebond automatique à l'atterrissage
- **Épuisette**, **couronne** → plus de bonbons / aimant

Le vestiaire montre en direct le personnage qui court avec la tenue, des barres
de stats (Vitesse / Saut / Légèreté / Bonbons) et les pouvoirs actifs, pour que
le choix soit lisible même sans savoir lire tous les chiffres.

## Structure

```
index.html          écrans + HUD (le monde est un <canvas> plein écran)
css/style.css       habillage, grosses cibles tactiles, paysage + portrait
js/data.js          personnages, vêtements, décors, obstacles, équilibrage
js/dom.js           3 helpers DOM (jamais d'innerHTML)
js/audio.js         sons générés en WebAudio (aucun fichier)
js/draw.js          dessin des personnages + vêtements (canvas)
js/world.js         décors, obstacles, bonbons, ligne d'arrivée
js/scene.js         décor animé derrière les menus + caméra / dimensions
js/dressing.js      choix du champion + vestiaire
js/race.js          physique, génération équitable, rivaux, arrivée
js/main.js          routeur d'écrans, entrées tactiles/clavier, boucle
test/sim.js         simulation headless (Node) : équité, tenues, flux complet
```

## Tester

```bash
node test/sim.js
```

La simulation joue des courses complètes avec un « autopilote » (deux styles :
tapotement court et appui maintenu) et vérifie notamment que :

- chaque course se termine, dans chacun des 5 décors ;
- **chaque obstacle est sautable** (écart entre obstacles ≥ besoin de saut),
  pour les 4 personnages ;
- toutes les tenues (et des tenues aléatoires) terminent la course sans être
  injouables ;
- les pouvoirs des vêtements ont bien l'effet annoncé ;
- le flux complet démarre → course → écran de résultats → rejouer.

## Réglages rapides

Tout l'équilibrage est dans `js/data.js` (`CF.COURSE`, `CF.CHARACTERS`,
`CF.CLOTHES`, `CF.ZONES`) : longueur de course, nombre de décors, bonbons pour
le boost, statistiques de chaque vêtement, gravité de chaque décor…

Raccourcis de développement (utiles aussi pour montrer un écran précis) :
`index.html#auto=race|dress|char|results|action`.

## Notes d'accessibilité & confort

- Pause automatique si l'onglet passe en arrière-plan ou si la tablette se met
  en veille.
- `prefers-reduced-motion` respecté (animations d'interface coupées).
- Pas de zoom/scroll parasites pendant la course (`touch-action`, viewport
  verrouillé) ; boutons ≥ 44 px pour les petits doigts.
- Aucun texte à lire pour jouer : tout passe par icônes, couleurs et barres.

## Publier sur GitHub Pages

Le site est servi depuis la branche `gh-pages` (copie exacte de `main`), car le
jeton utilisé n'a pas le droit d'API « Pages » — pousser la branche suffit à
GitHub pour publier, sans rien configurer.

```bash
./deploy.sh          # = git push origin main:gh-pages --force
```

URL publique : <https://fcrozat.github.io/course-folle/>

- Tout est en chemins relatifs, donc le jeu fonctionne sous le sous-dossier
  `/course-folle/` sans réglage de « base path ».
- Si tu préfères servir depuis `main` directement : GitHub → *Settings → Pages
  → Source : Deploy from a branch → main / (root)*, puis supprime `gh-pages`.
  (Une manipulation manuelle, car l'API Pages exige un droit que le jeton n'a
  pas ; `deploy.sh` devient alors inutile.)
- Vérifier l'état de la publication :
  `gh api repos/fcrozat/course-folle/pages --jq .status` (`building` → `built`).
