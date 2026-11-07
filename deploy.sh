#!/usr/bin/env bash
# ============================================================================
# Publie le jeu sur GitHub Pages.
# Le site est servi depuis la branche `gh-pages`, qui est une copie exacte de
# `main` : une seule commande pour mettre à jour après chaque modification.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  Des modifications ne sont pas commitées : pense à committer d'abord"
  echo "   (sinon elles ne partiront pas sur gh-pages)."
fi

git push origin main:gh-pages --force

remote=$(git remote get-url origin)
repo=${remote#*github.com/}
repo=${repo%.git}
owner=${repo%%/*}
name=${repo#*/}

echo
echo "✅ Publié : https://${owner}.github.io/${name}/"
echo "   Première mise en ligne : ~1 minute. Mises à jour suivantes : quasi immédiat."
echo "   Statut : gh api repos/${owner}/${name}/pages --jq .status"
