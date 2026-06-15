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
- **Statut** : à valider avec Victor

---

## 🟠 #2 — Usage unique des jokers non validé côté serveur

- **Domaine** : serveur — `shared/tictacdie.ts`, `Game.action()`
- **Contexte** : chaque joker doit être utilisable **une seule fois** par partie. La garde est faite côté client (`game.js` : un joker consommé est grisé/non cliquable), mais le serveur ne vérifie rien.
- **Risque** : un client modifié peut rejouer plusieurs fois le même joker — le serveur l'accepte.
- **Fix proposé** : la liste des jokers de chaque joueur existe déjà dans `Game` (`p1.jokers` / `p2.jokers`, tirée du seed). Dans `action()`, vérifier que le joker demandé est encore dans la liste du joueur, puis le retirer après succès. Refuser sinon (`[false, "joker already used"]`).
- **Statut** : à voir avec Victor (côté front la garde est en place)

---

## 🟠 #3 — Immunity applicable sur un symbole ennemi

- **Domaine** : partagé (règle) — `shared/tictacdie.ts`, `placeImmunity()`
- **Observé** : on peut poser une immunity sur un symbole adverse. `placeImmunity` ne vérifie pas à qui appartient le symbole de la case.
- **À trancher avec Victor** : est-ce voulu ? Si l'immunity ne doit protéger que ses propres symboles, ajouter la vérification côté serveur.
- **Statut** : question de règle, à discuter
