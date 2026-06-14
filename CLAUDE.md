# CLAUDE.md — tictacdie

## Projet

Tic Tac Toe 3×3 tour par tour enrichi de **jokers** (pouvoirs spéciaux à usage unique). Chaque joker remplace le tour du joueur — impossible de poser un symbole ET jouer un joker au même tour.

## Stack

- Runtime : **Deno** (TypeScript)
- Tests : `deno test shared/tictacdie_test.ts`
- Dev server : `deno task dev`

## Répartition du travail

- **Alexis** : logique de jeu (`shared/tictacdie.ts`) + frontend (`client/`)
- **Victor** : serveur, WebSocket, netcode (`main.ts`)

Ne pas toucher à `main.ts` sauf indication explicite d'Alexis.

## Git

- Ne **jamais push sur GitHub** sans instruction explicite d'Alexis.
- Branche active du travail d'Alexis : `lib_alexis_part`

## Architecture `shared/tictacdie.ts`

### Conventions de coordonnées

- `x` = colonne, `y` = ligne — `board[y][x]`
- `applyInvert(row, index)` : `row = 1` → ligne, `row = 0` → colonne (⚠️ inversé vs ancienne convention)
- `applyBomb(x, y)` : centre de la croix en (x, y)

### Type `Cell` — discriminant `kind`

Logique encapsulée dans une **classe `Game`** ; constructeur seedé : `new Game(seed, p1, p2)`.

`Empty` = `""`, `Symbol` = `"X" | "O"`. Les cellules objet portent un `kind` :
`"nomad" | "immunity" | "trap" | "virus" | "ttt"`.
Détection : `typeof cell === "object" && cell.kind === ...`.

## État d'avancement

### Implémenté et testé

- `applyInvert(axis: 0|1, index)` — délègue à `invertRow` / `invertCol` (module-level)
- `applyResize(top, bottom, left, right)` — agrandit le board en NxN → (N+1)x(N+1)
- `applyBomb(x, y)` — vide la croix, épargne les Immunity
- `placeTrap(x, y, ax, ay)` — pose un piège sur une case vide
- `placeSymbol` — intercepte les Trap : redirige si redirect libre, sinon pose sur la case piège
- `tick` — nettoyage caduc : supprime les pièges dont la redirect est occupée
- `placeNomad`, `placeImmunity` — implémentés par Victor

### Stubs (non implémentés)

- `placeVirus`, `placeTTT`, `isGameOver`
- `tick` : gère uniquement le caduc Trap pour l'instant — Nomad et Virus à venir

## Règles des jokers (tranchées)

### Trap (Piège)
- Posé sur une case **vide**. Redirect peut être occupée à la pose (check lazy au déclenchement).
- Si B joue sur la case piégée et la redirect est **vide** → symbole posé sur la redirect, piège consommé.
- Si B joue sur la case piégée et la redirect est **occupée** → symbole posé sur la case piège, piège consommé.
- **Caduc** : si un symbole est joué sur la redirect (par n'importe qui), `tick` supprime le piège.
- A peut tomber dans son propre piège. Le piège est invisible pour tous.
- Un Nomad qui traverse la case piégée ne l'active pas (il "vole" au-dessus).

### Invert (Swap)
- `axis 0` = row, `axis 1` = col. Index hors bornes → `false`.
- Immunity : inchangée. TTT : invincible. Trap : inchangé (toujours vide). Virus : inchangé.
- Nomad : `content` et `old_content` s'inversent tous les deux.

### Bomb
- Vide la croix (centre + 4 adjacents). Immunity dans la croix → épargnée.
- Centre immune → la bombe s'active quand même, seuls les voisins sont détruits.
- Peut être posée n'importe où (aucune restriction de case).

### Resize (Expansion)
- Agrandit le board d'un coin choisi (NxN → (N+1)x(N+1)). Board toujours carré.
- Nécessite exactement un bord horizontal (top/bottom) ET un bord vertical (left/right).
- La condition de victoire s'adapte à la nouvelle dimension.

### Immunity
- Durée fixe : 2 tours. Expire au début du tour du joueur qui l'a activée.
- Immune aux jokers adverses (Invert, Bomb, etc.).

### Nomad (Voyageur)
- Disparaît au bord du plateau. Compte pour la victoire en transit.
- `old_content` = symbole qui était sur la case avant l'arrivée du Nomad.

### Virus
- Recalcule à chaque tour (step passif comme le Nomad).
- Prend le symbole majoritaire parmi les 8 cases voisines. Égalité → neutre.
- `applyInvert` n'affecte pas le Virus lui-même, seulement les cases autour.
