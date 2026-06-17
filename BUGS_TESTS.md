# BUGS — tests du jeu

Liste des bugs relevés pendant les tests manuels du jeu, à discuter avec Victor.

Légende : 🔴 critique (bloque le jeu) · 🟠 fonctionnel (jouable mais incorrect) · 🟡 mineur/cosmétique
Domaine : **serveur** (Victor) · **front** (Alexis) · **partagé**

---

## 🔴 #1 — Le tour avance même quand l'action échoue → désync "not your turn"

- **Domaine** : serveur — `shared/tictacdie.ts`, `Game.action()` (ligne 174)
- **Repro** : A pose une immunity (succès). B voit "À toi de jouer", clique une case **occupée** (ex. la case de l'immunity). Le serveur renvoie un "ko" de placement *mais incrémente quand même le tour*. B réessaie sur une case valide → **"not your turn"** en boucle.
- **Cause** : `this.tick()` est appelé inconditionnellement à la fin de `action()`, même si `res === false`. Le tour avance donc sur une action invalide. Le client ne peut pas se resync car le "ko" renvoie le board mais **pas** le numéro de tour.
- **Fix proposé** : ne ticker que sur succès :
  ```ts
  if (res) this.tick();
  return [res, message];
  ```
- **Statut** : ✅ **corrigé par Victor** (branche `libgame_part1`, commit `f48683c`) — `action()` ne ticke plus que si `res`. ⚠️ Le client (`game.js`) ne resync toujours pas le tour ; le `"ko"` enrichi (`turn`, `p1`, `p2`) est désormais dispo pour le faire — **à brancher côté front**.

---

## 🟠 #2 — Usage unique des jokers non validé côté serveur

- **Domaine** : serveur — `shared/tictacdie.ts`, `Game.action()`
- **Contexte** : chaque joker doit être utilisable **une seule fois** par partie. La garde est faite côté client (`game.js` : un joker consommé est grisé/non cliquable), mais le serveur ne vérifie rien.
- **Risque** : un client modifié peut rejouer plusieurs fois le même joker — le serveur l'accepte.
- **Fix proposé** : la liste des jokers de chaque joueur existe déjà dans `Game` (`p1.jokers` / `p2.jokers`, tirée du seed). Dans `action()`, vérifier que le joker demandé est encore dans la liste du joueur, puis le retirer après succès. Refuser sinon (`[false, "joker already used"]`).
- **Statut** : ✅ **implémenté par Victor** (commit `f48683c`) — check de possession + retrait du joker sur succès. ⚠️ Mais l'implémentation contenait plusieurs bugs (cf. #5, #6, #7), corrigés au merge dans `front`.

---

## 🟠 #3 — Immunity applicable sur un symbole ennemi

- **Domaine** : partagé (règle) — `shared/tictacdie.ts`, `placeImmunity()`
- **Observé** : on peut poser une immunity sur un symbole adverse. `placeImmunity` ne vérifie pas à qui appartient le symbole de la case.
- **À trancher avec Victor** : est-ce voulu ? Si l'immunity ne doit protéger que ses propres symboles, ajouter la vérification côté serveur.
- **Statut** : question de règle, à discuter

---

## 🟠 #4 — Poser un virus sur un trap ne déclenche pas la redirection

- **Domaine** : serveur — `shared/tictacdie.ts`, `placeVirus()` (et autres poses de jokers)
- **Observé** : poser un virus sur une case piégée n'est pas redirigé — le virus écrase simplement le trap. Seul `placeSymbol` gère la redirection des pièges ; les poses de jokers (virus, immunity, nomad…) l'ignorent.
- **À trancher avec Victor** : un joker posé sur un trap doit-il être redirigé comme un symbole, ou écraser/ignorer le piège ? (les règles de CLAUDE.md ne décrivent la redirection que pour les symboles)
- **Statut** : ✅ **implémenté pour le virus par Victor** (commit `c732437`) — `placeVirus` gère la redirection du trap comme `placeSymbol`. ⚠️ Les autres poses de jokers (immunity, nomad…) l'ignorent toujours ; reste la question de règle de fond.

---

# Bugs introduits par `libgame_part1` (relevés au merge dans `front`)

Bugs trouvés dans l'implémentation des fixes ci-dessus par Victor, **corrigés au merge** dans `shared/tictacdie.ts` (fichier d'Alexis). À signaler à Victor pour qu'il aligne sa branche.

## 🔴 #5 — `action()` : `.include` au lieu de `.includes` (TypeError)

- **Domaine** : serveur — `shared/tictacdie.ts`, `Game.action()`
- **Code** : `this.p1.jokers.include(card)` / `this.p2.jokers.include(card)`. `Array.include` n'existe pas → **`TypeError` à chaque action**, le jeu ne tourne plus.
- **Fix appliqué** : `include` → `includes`.

## 🔴 #6 — `action()` : check/retrait de possession appliqué à `"symbol"`

- **Domaine** : serveur — `shared/tictacdie.ts`, `Game.action()`
- **Problème** : `"symbol"` (pose normale) n'est **pas** un joker. Le check de possession le rejetait (`"You do not possess this joker"`) → **toute pose de symbole impossible**. Le retrait `splice` sur `"symbol"` (absent → `indexOf` = -1) **supprimait le dernier joker** du joueur.
- **Fix appliqué** : encadrer check **et** retrait par `if (card !== "symbol") { … }`.

## 🟠 #7 — `action()` : `splice` du retrait de joker incorrect

- **Domaine** : serveur — `shared/tictacdie.ts`, `Game.action()`
- **Code** : `if (player_index === 1) this.p2.jokers.splice(this.p1.jokers.indexOf(card));`
  - utilise **`this.p1`** pour l'index dans la branche du joueur 2 ;
  - `splice(index)` **sans 2e argument** supprime tout depuis l'index jusqu'à la fin (au lieu d'un seul élément).
- **Fix appliqué** : `this.p2.jokers.splice(this.p2.jokers.indexOf(card), 1)` (et `, 1` côté p1).

## 🔴 #8 — `placeVirus()` : objet virus non typé → erreur de type-check

- **Domaine** : serveur — `shared/tictacdie.ts`, `placeVirus()`
- **Code** : `const v = {kind: "virus", content: ""};` — `kind` est inféré `string` (pas le littéral `"virus"`) → **3× `TS2322`**, `deno test`/`deno check` échouent.
- **Fix appliqué** : `const v: Virus = {kind: "virus", content: ""};`.

## 🟠 #9 — 7 tests rouges : nouvelle logique vs tests non mis à jour

- **Domaine** : partagé — `tests/tictacdie_action_test.ts`, `tests/handler_game_test.ts`
- **Problème** : les changements de comportement de Victor contredisent ses propres tests, qui n'ont pas été mis à jour :
  - **Check de possession** : `invert - inverts a row/column`, `trap - places trap`, `virus - places virus on cell` jouent des cartes **absentes** de la main seed 0 (`["resize","bomb","nomad","immunity"]`) → désormais rejetées.
  - **`tick` sur succès uniquement** : `unknown card: tick still runs` et `tick always runs even if card fails` supposent l'ancien comportement (tick inconditionnel) → le tour n'avance plus.
  - `acting out of turn sends ko` (handler) : à revoir avec le protocole `"ko"` enrichi.
- **À décider (Victor + Alexis)** : adapter les tests au nouveau comportement (donner les bons jokers, attendre tick sur succès) **ou** ajuster la logique. Non tranché côté `front` — laissé à Victor.
- **Statut** : ⛔ ouvert — 188 passent / 7 échouent après merge.
