// logic.ts — applique les actions et le tick passif via l'instance Game PARTAGÉE
// (shared/tictacdie.ts). Plus de duplication de la logique : la mutation du board vient
// directement de Game ; ce module ne fait qu'orchestrer les animations associées.
import { S } from "./state.ts";
import { playEffect, fadeOutSymbols, playImmunity, playInvertTransitions, morphVirus, dismissImmunity } from "./anim.ts";

// Symboles X/O détruits par une bombe en (x,y) — capturés AVANT le vidage, pour le fondu.
// Mirroir d'applyBomb : les objets à cooldown (nomad/immunité) sont épargnés, donc ignorés.
function collectBombSymbols(board, x, y) {
	const cleared = [];
	for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
		const nx = x + dx, ny = y + dy;
		if (ny < 0 || ny >= board.length || nx < 0 || nx >= board[ny].length) continue;
		const c = board[ny][nx];
		if (typeof c === "object" && c && "cooldown" in c) continue; // nomad/immunité épargnés
		const sym = (c === "X" || c === "O") ? c
			: (typeof c === "object" && c && c.kind === "virus" && (c.content === "X" || c.content === "O")) ? c.content
			: null;
		if (sym) cleared.push({ x: nx, y: ny, sym });
	}
	return cleared;
}

// Symboles inversés par un Invert — capturés AVANT le flip, pour l'anim de transition.
// axis === 1 -> ligne (index = ligne) ; axis === 0 -> colonne (index = colonne).
function collectInvertSymbols(board, axis, index) {
	const swapped = [];
	if (axis === 1) {
		for (let i = 0; i < board[index].length; i++) {
			const c = board[index][i];
			if (c === "X" || c === "O") swapped.push({ x: i, y: index, from: c });
		}
	} else {
		for (let j = 0; j < board.length; j++) {
			const c = board[j][index];
			if (c === "X" || c === "O") swapped.push({ x: index, y: j, from: c });
		}
	}
	return swapped;
}

// Applique une action sur l'instance Game (sans le check de tour/possession d'action() :
// la pose optimiste est déjà validée par l'UI / le serveur), puis joue l'animation.
export function applyLocalTEMP(a) {
	const g = S.game;
	const { card, x, y, opt1, opt2, opt3 } = a;

	if (card === "symbol") {
		g.placeSymbol(x, y, opt3);
	} else if (card === "trap") {
		g.placeTrap(x, y, opt1, opt2);
	} else if (card === "immunity") {
		g.placeImmunity(x, y);
		const cell = g.board[y][x];
		if (typeof cell === "object" && cell.kind === "immunity") playImmunity(cell, x, y);
	} else if (card === "virus") {
		g.placeVirus(x, y);
	} else if (card === "nomad") {
		g.placeNomad(x, y, opt1, opt2, opt3);
	} else if (card === "bomb") {
		const cleared = collectBombSymbols(g.board, x, y); // avant le vidage
		g.applyBomb(x, y);
		playEffect("bomb", x, y);
		fadeOutSymbols(cleared);
	} else if (card === "invert") {
		const swapped = collectInvertSymbols(g.board, x, y); // avant le flip (x = axe, y = index)
		g.applyInvert(x, y);
		playInvertTransitions(swapped);
	} else if (card === "resize") {
		g.applyResize(x === 1, y === 1, opt1 === 1, opt2 === 1);
	}

	S.board = g.board; // applyResize remplace le tableau : on re-pointe
}

// Tick passif (nomad/immunité/virus) délégué à Game.tick(), encadré par la détection des
// changements pour rejouer les animations : pop-out d'immunité expirée, morph de virus muté.
export function localTick() {
	const g = S.game;

	// Snapshot AVANT tick : immunités sur le point d'expirer (cooldown 0 -> -1) + contenu des virus.
	const immToDismiss = [];
	const virusBefore = [];
	for (let j = 0; j < g.board.length; j++) {
		for (let i = 0; i < g.board[0].length; i++) {
			const cell = g.board[j][i];
			if (typeof cell !== "object" || !cell) continue;
			if (cell.kind === "immunity" && cell.cooldown === 0 && cell._fx) immToDismiss.push(cell._fx);
			if (cell.kind === "virus") virusBefore.push({ cell, x: i, y: j, content: cell.content });
		}
	}

	g.tick();
	S.board = g.board;

	// Immunités expirées : l'APNG figé grossit puis se contracte (l'objet est détaché du board
	// mais on garde sa référence _fx pour l'animer).
	for (const fx of immToDismiss) dismissImmunity(fx);

	// Virus mutés : on garde l'ancien symbole affiché le temps de l'anim, puis morph bascule.
	for (const v of virusBefore) {
		if (v.cell.content !== v.content) {
			v.cell.displayContent = v.content; // ancien symbole (en retard sur content le temps de l'anim)
			morphVirus(v.cell, v.x, v.y);
		}
	}
}
