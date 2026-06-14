import { assertEquals } from "jsr:@std/assert";
import * as ttd from "./tictacdie.ts";

// seed=0 gives turn=0 (player 1 first). We override to 1 so player 0 always goes first
// across all tests, keeping assertions intuitive (X=player0, O=player1).
function makeGame(): ttd.Game {
	const g = new ttd.Game(0, "p1", "p2");
	g.turn = 1;
	return g;
}

// ─── init ────────────────────────────────────────────────────────────────────

Deno.test("init - board is 3x3 and all cells empty", () => {
	const g = makeGame();
	assertEquals(g.board.length, 3);
	for (let j = 0; j < 3; j++) {
		assertEquals(g.board[j].length, 3);
		for (let i = 0; i < 3; i++) {
			assertEquals(g.board[j][i], "");
		}
	}
});

// ─── isGameOver ──────────────────────────────────────────────────────────────

Deno.test("isGameOver - empty board: not over", () => {
	const g = makeGame();
	assertEquals(g.isGameOver(), -1);
});

Deno.test("isGameOver - partial board, no winner: not over", () => {
	const g = makeGame();
	g.board[0][0] = "X"; g.board[1][1] = "O";
	assertEquals(g.isGameOver(), -1);
});

Deno.test("isGameOver - X wins row 0", () => {
	const g = makeGame();
	g.board[0] = ["X", "X", "X"];
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - X wins row 1", () => {
	const g = makeGame();
	g.board[1] = ["X", "X", "X"];
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - X wins row 2", () => {
	const g = makeGame();
	g.board[2] = ["X", "X", "X"];
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - O wins row", () => {
	const g = makeGame();
	g.board[1] = ["O", "O", "O"];
	assertEquals(g.isGameOver(), 2);
});

Deno.test("isGameOver - X wins column 0", () => {
	const g = makeGame();
	g.board[0][0] = "X"; g.board[1][0] = "X"; g.board[2][0] = "X";
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - O wins column 2", () => {
	const g = makeGame();
	g.board[0][2] = "O"; g.board[1][2] = "O"; g.board[2][2] = "O";
	assertEquals(g.isGameOver(), 2);
});

Deno.test("isGameOver - X wins main diagonal", () => {
	const g = makeGame();
	g.board[0][0] = "X"; g.board[1][1] = "X"; g.board[2][2] = "X";
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - X wins anti-diagonal", () => {
	const g = makeGame();
	g.board[0][2] = "X"; g.board[1][1] = "X"; g.board[2][0] = "X";
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - O wins anti-diagonal", () => {
	const g = makeGame();
	g.board[0][2] = "O"; g.board[1][1] = "O"; g.board[2][0] = "O";
	assertEquals(g.isGameOver(), 2);
});

Deno.test("isGameOver - draw: full board no winner", () => {
	const g = makeGame();
	g.board = [
		["X", "O", "X"],
		["O", "X", "X"],
		["O", "X", "O"],
	];
	assertEquals(g.isGameOver(), 0);
});

// ─── placeSymbol ─────────────────────────────────────────────────────────────

Deno.test("placeSymbol - places X on empty cell", () => {
	const g = makeGame();
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[0][0], "X");
});

Deno.test("placeSymbol - places O on another empty cell", () => {
	const g = makeGame();
	g.placeSymbol(2, 1, "O");
	assertEquals(g.board[1][2], "O");
});

Deno.test("placeSymbol - occupied cell returns false, board unchanged", () => {
	const g = makeGame();
	g.board[0][0] = "O";
	const [ok] = g.placeSymbol(0, 0, "X");
	assertEquals(ok, false);
	assertEquals(g.board[0][0], "O");
});

Deno.test("placeSymbol - out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.placeSymbol(99, 0, "X")[0], false);
	assertEquals(g.placeSymbol(0, 99, "X")[0], false);
});

// ─── placeSymbol (trap) ──────────────────────────────────────────────────────

Deno.test("placeSymbol (trap) - redirect vide: symbole posé sur la redirect, case piège vidée", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[2][2], "X");
	assertEquals(g.board[0][0], "");
});

Deno.test("placeSymbol (trap) - redirect occupée: symbole posé sur la case piège", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.board[2][2] = "O";
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[0][0], "X");
	assertEquals(g.board[2][2], "O");
});

Deno.test("placeSymbol (trap) - A peut tomber dans son propre piège", () => {
	const g = makeGame();
	g.placeTrap(1, 1, 0, 0);
	g.placeSymbol(1, 1, "X");
	assertEquals(g.board[0][0], "X");
	assertEquals(g.board[1][1], "");
});

// ─── placeNomad ──────────────────────────────────────────────────────────────

Deno.test("placeNomad - se déplace vers la droite à travers le board", () => {
	const g = makeGame();
	g.placeNomad(0, 0, 1, 0, "X");
	g.tick();
	assertEquals(g.board[0][0], {kind: "nomad", cooldown: 0, dirx: 1, diry: 0, content: "X", old_content: ""});
	g.tick();
	assertEquals(g.board[0][1], {kind: "nomad", cooldown: 0, dirx: 1, diry: 0, content: "X", old_content: ""});
	g.tick(); g.tick();
	assertEquals(g.board[0][2], ""); // quitte le board
});

Deno.test("placeNomad - déplace un symbole sur impact", () => {
	const g = makeGame();
	g.placeSymbol(1, 1, "O");
	g.placeNomad(1, 2, 0, -1, "X");
	g.tick();
	assertEquals(g.board[2][1], {kind: "nomad", cooldown: 0, dirx: 0, diry: -1, content: "X", old_content: ""});
	g.tick();
	assertEquals(g.board[1][1], {kind: "nomad", cooldown: -1, dirx: 0, diry: -1, content: "X", old_content: "O"});
	g.tick(); g.tick();
	assertEquals(g.board[0][1], "");
});

Deno.test("placeNomad - position intérieure refusée", () => {
	const g = makeGame();
	const [ok] = g.placeNomad(1, 1, 1, 0, "X");
	assertEquals(ok, false);
});

Deno.test("placeNomad - direction diagonale refusée", () => {
	const g = makeGame();
	const [ok] = g.placeNomad(0, 0, 1, 1, "X");
	assertEquals(ok, false);
});

// ─── placeImmunity ───────────────────────────────────────────────────────────

Deno.test("placeImmunity - cooldown décrémente à chaque tick et disparaît à 0", () => {
	const g = makeGame();
	g.placeImmunity(0, 0);
	assertEquals(g.board[0][0], {kind: "immunity", cooldown: 2, content: ""});
	g.tick();
	assertEquals(g.board[0][0], {kind: "immunity", cooldown: 1, content: ""});
	g.tick(); g.tick();
	assertEquals(g.board[0][0], "");
});

Deno.test("placeImmunity - restaure le contenu à l'expiration", () => {
	const g = makeGame();
	g.board[0][0] = "X";
	g.placeImmunity(0, 0);
	assertEquals((g.board[0][0] as unknown as ttd.Immunity).content, "X");
	g.tick(); g.tick(); g.tick();
	assertEquals(g.board[0][0], "X");
});

// ─── placeVirus ──────────────────────────────────────────────────────────────

Deno.test("placeVirus - démarre vide", () => {
	const g = makeGame();
	g.placeVirus(0, 0);
	assertEquals(g.board[0][0], {kind: "virus", content: ""});
});

Deno.test("placeVirus - majorité X: content devient X", () => {
	const g = makeGame();
	g.placeVirus(0, 0);
	g.placeSymbol(1, 0, "X");
	g.tick();
	assertEquals(g.board[0][0], {kind: "virus", content: "X"});
});

Deno.test("placeVirus - égalité X/O: content vidé", () => {
	const g = makeGame();
	g.placeVirus(0, 0);
	g.placeSymbol(1, 0, "X");
	g.tick();
	g.placeSymbol(0, 1, "O");
	g.tick();
	assertEquals((g.board[0][0] as unknown as ttd.Virus).content, "");
});

Deno.test("placeVirus - majorité O: content devient O", () => {
	const g = makeGame();
	g.placeVirus(1, 1);
	g.board[0][1] = "O"; g.board[2][1] = "O";
	g.board[1][0] = "X";
	g.tick();
	assertEquals((g.board[1][1] as unknown as ttd.Virus).content, "O");
});

// ─── placeTrap ───────────────────────────────────────────────────────────────

Deno.test("placeTrap - pose normale sur case vide", () => {
	const g = makeGame();
	const [ok] = g.placeTrap(0, 0, 2, 2);
	assertEquals(ok, true);
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

Deno.test("placeTrap - refuse si case piège occupée", () => {
	const g = makeGame();
	g.board[0][0] = "X";
	const [ok] = g.placeTrap(0, 0, 2, 2);
	assertEquals(ok, false);
});

Deno.test("placeTrap - refuse si (x,y) hors bornes", () => {
	const g = makeGame();
	assertEquals(g.placeTrap(99, 0, 1, 1)[0], false);
	assertEquals(g.placeTrap(0, 99, 1, 1)[0], false);
});

Deno.test("placeTrap - refuse si redirect (ax,ay) hors bornes", () => {
	const g = makeGame();
	assertEquals(g.placeTrap(0, 0, 99, 1)[0], false);
	assertEquals(g.placeTrap(0, 0, 1, 99)[0], false);
});

Deno.test("placeTrap - redirect occupée à la pose est acceptée (check lazy)", () => {
	const g = makeGame();
	g.board[2][2] = "X";
	const [ok] = g.placeTrap(0, 0, 2, 2);
	assertEquals(ok, true);
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

Deno.test("placeTrap - piège pointant vers lui-même: place le symbole sur la case piège", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 0, 0);
	g.placeSymbol(0, 0, "X");
	// redirect == trap cell, which is occupied → symbol placed on the trap cell itself
	assertEquals(g.board[0][0], "X");
});

// ─── tick ────────────────────────────────────────────────────────────────────

Deno.test("tick - piège inchangé si la redirect est vide", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.tick();
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

Deno.test("tick - piège inchangé si la redirect est occupée", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.board[2][2] = "O";
	g.tick();
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

// ─── applyInvert ─────────────────────────────────────────────────────────────

Deno.test("applyInvert - inverse la ligne", () => {
	const g = makeGame();
	g.board[0] = ["X", "", "O"];
	g.applyInvert(1, 0);
	assertEquals(g.board[0], ["O", "", "X"]);
});

Deno.test("applyInvert - inverse la colonne", () => {
	const g = makeGame();
	g.board[0][0] = "X"; g.board[1][0] = ""; g.board[2][0] = "O";
	g.applyInvert(0, 0);
	assertEquals(g.board[0][0], "O");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[2][0], "X");
});

Deno.test("applyInvert - inverse le contenu et old_content d'une cellule nomad", () => {
	const g = makeGame();
	g.placeSymbol(1, 0, "X");
	g.placeSymbol(0, 0, "O");
	g.placeNomad(0, 0, 1, 0, "X");
	g.placeImmunity(1, 0);
	g.applyInvert(0, 0);
	assertEquals(g.board[0], [
		{kind: "nomad", cooldown: 1, dirx: 1, diry: 0, content: "O", old_content: "X"},
		{kind: "immunity", cooldown: 2, content: "X"},
		""
	]);
});

Deno.test("applyInvert - cellules trap et virus non modifiées par invert", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.placeVirus(2, 0);
	g.applyInvert(1, 0); // invert row 0
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
	assertEquals(g.board[0][2], {kind: "virus", content: ""});
});

// ─── applyResize ─────────────────────────────────────────────────────────────

Deno.test("applyResize - coin haut-gauche: board passe en 4x4, contenu décalé bas-droite", () => {
	const g = makeGame();
	g.board[0][0] = "X";
	g.applyResize(true, false, true, false);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[1][1], "X");
	assertEquals(g.board[0][0], "");
});

Deno.test("applyResize - coin haut-droit: board passe en 4x4, contenu décalé vers le bas", () => {
	const g = makeGame();
	g.board[0][2] = "X";
	g.applyResize(true, false, false, true);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[1][2], "X");
	assertEquals(g.board[0][3], "");
});

Deno.test("applyResize - coin bas-gauche: board passe en 4x4, contenu décalé vers la droite", () => {
	const g = makeGame();
	g.board[2][0] = "X";
	g.applyResize(false, true, true, false);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[2][1], "X");
	assertEquals(g.board[3][0], "");
});

Deno.test("applyResize - coin bas-droit: board passe en 4x4, contenu inchangé en position", () => {
	const g = makeGame();
	g.board[2][2] = "X";
	g.applyResize(false, true, false, true);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[2][2], "X");
	assertEquals(g.board[3][3], "");
});

Deno.test("applyResize - aucun coin sélectionné: board inchangé", () => {
	const g = makeGame();
	g.applyResize(false, false, false, false);
	assertEquals(g.board.length, 3);
	assertEquals(g.board[0].length, 3);
});

Deno.test("applyResize - les cellules complexes sont préservées et déplacées", () => {
	const g = makeGame();
	g.board[1][1] = {kind: "immunity", cooldown: 2, content: "X"};
	g.applyResize(true, false, true, false);
	assertEquals(g.board[2][2], {kind: "immunity", cooldown: 2, content: "X"});
});

// ─── applyBomb ───────────────────────────────────────────────────────────────

Deno.test("applyBomb - centre (1,1): détruit la case et la croix", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	g.applyBomb(1, 1);
	assertEquals(g.board[1][1], "");
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[2][1], "");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[1][2], "");
	assertEquals(g.board[0][0], "X"); // coins non affectés
	assertEquals(g.board[2][2], "X");
});

Deno.test("applyBomb - coin (0,0): seulement les voisins valides détruits", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	g.applyBomb(0, 0);
	assertEquals(g.board[0][0], "");
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[1][1], "X");
});

Deno.test("applyBomb - bord haut (1,0): pas de crash hors plateau", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	g.applyBomb(1, 0);
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[0][0], "");
	assertEquals(g.board[0][2], "");
	assertEquals(g.board[1][1], "");
});

Deno.test("applyBomb - une case immune dans la croix n'est pas détruite", () => {
	const g = makeGame();
	g.board[0][1] = {kind: "immunity", cooldown: 2, content: "X"};
	g.applyBomb(1, 1);
	assertEquals(g.board[0][1], {kind: "immunity", cooldown: 2, content: "X"});
	assertEquals(g.board[1][1], "");
});

Deno.test("applyBomb - centre immune: bombe s'active, seuls les voisins détruits", () => {
	const g = makeGame();
	g.board = [
		["X", "O", "X"],
		["O", {kind: "immunity", cooldown: 3, content: "X"}, "O"],
		["X", "O", "X"],
	];
	g.applyBomb(1, 1);
	assertEquals(g.board[1][1], {kind: "immunity", cooldown: 3, content: "X"});
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[2][1], "");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[1][2], "");
	assertEquals(g.board[0][0], "X");
});

Deno.test("applyBomb - détruit un piège dans la croix (pas de cooldown)", () => {
	const g = makeGame();
	g.placeTrap(1, 0, 2, 2);
	g.applyBomb(1, 1);
	assertEquals(g.board[0][1], "");
});

// ─── action - validation générale ────────────────────────────────────────────

Deno.test("action - jouer hors de son tour: retourne false", () => {
	const g = makeGame();
	const [ok] = g.action(1, "symbol", 0, 0, 0, 0, "X");
	assertEquals(ok, false);
});

Deno.test("action - player_index invalide: retourne false", () => {
	const g = makeGame();
	assertEquals(g.action(-1, "symbol", 0, 0, 0, 0, "X")[0], false);
	assertEquals(g.action(2,  "symbol", 0, 0, 0, 0, "X")[0], false);
});

Deno.test("action - carte inconnue: retourne false", () => {
	const g = makeGame();
	const [ok] = g.action(0, "joker_inexistant", 0, 0, 0, 0, "");
	assertEquals(ok, false);
});

// ─── action - gestion des tours ──────────────────────────────────────────────

Deno.test("action - le tour passe à l'adversaire après un succès", () => {
	const g = makeGame();
	g.action(0, "symbol", 0, 0, 0, 0, "X");
	const [ok] = g.action(1, "symbol", 1, 1, 0, 0, "O");
	assertEquals(ok, true);
	assertEquals(g.board[1][1], "O");
});

Deno.test("action - l'adversaire ne peut pas jouer sur une case déjà occupée", () => {
	const g = makeGame();
	g.action(0, "symbol", 0, 0, 0, 0, "X");
	const [ok] = g.action(1, "symbol", 0, 0, 0, 0, "O");
	assertEquals(ok, false);
});

// ─── action symbol ───────────────────────────────────────────────────────────

Deno.test("action symbol - player 0 pose X", () => {
	const g = makeGame();
	const [ok] = g.action(0, "symbol", 1, 1, 0, 0, "X");
	assertEquals(ok, true);
	assertEquals(g.board[1][1], "X");
});

Deno.test("action symbol - player 1 pose O", () => {
	const g = makeGame();
	g.action(0, "symbol", 0, 0, 0, 0, "X");
	const [ok] = g.action(1, "symbol", 1, 1, 0, 0, "O");
	assertEquals(ok, true);
	assertEquals(g.board[1][1], "O");
});

Deno.test("action symbol - case occupée: retourne false", () => {
	const g = makeGame();
	g.board[1][1] = "O";
	const [ok] = g.action(0, "symbol", 1, 1, 0, 0, "X");
	assertEquals(ok, false);
});

Deno.test("action symbol - hors bornes: retourne false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "symbol", 99, 0,  0, 0, "X")[0], false);
	assertEquals(g.action(0, "symbol", 0,  99, 0, 0, "X")[0], false);
});

// ─── action invert ───────────────────────────────────────────────────────────

Deno.test("action invert - inverse la ligne x", () => {
	const g = makeGame();
	g.board[0] = ["X", "O", "X"];
	const [ok] = g.action(0, "invert", 1, 0, 0, 0, "");
	assertEquals(ok, true);
	assertEquals(g.board[0], ["O", "X", "O"]);
});

Deno.test("action invert - inverse la colonne x", () => {
	const g = makeGame();
	g.board[0][0] = "X"; g.board[1][0] = "O"; g.board[2][0] = "X";
	const [ok] = g.action(0, "invert", 0, 0, 1, 0, "");
	assertEquals(ok, true);
	assertEquals(g.board[0][0], "O");
	assertEquals(g.board[1][0], "X");
	assertEquals(g.board[2][0], "O");
});

Deno.test("action invert - index hors bornes: retourne false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "invert", 99, 0, 0, 0, "")[0], false);
	assertEquals(g.action(0, "invert", 99, 0, 1, 0, "")[0], false);
});

// ─── action bomb ─────────────────────────────────────────────────────────────

Deno.test("action bomb - vide la croix autour de (x, y)", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	const [ok] = g.action(0, "bomb", 1, 1, 0, 0, "");
	assertEquals(ok, true);
	assertEquals(g.board[1][1], "");
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[2][1], "");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[1][2], "");
	assertEquals(g.board[0][0], "X");
});

Deno.test("action bomb - centre hors bornes: retourne false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "bomb", 99, 0,  0, 0, "")[0], false);
	assertEquals(g.action(0, "bomb", 0,  99, 0, 0, "")[0], false);
});

// ─── action resize ───────────────────────────────────────────────────────────

Deno.test("action resize - coin haut-gauche: board passe en 4x4", () => {
	const g = makeGame();
	const [ok] = g.action(0, "resize", 1, 0, 1, 0, "");
	assertEquals(ok, true);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
});

Deno.test("action resize - coin bas-droit: board passe en 4x4", () => {
	const g = makeGame();
	const [ok] = g.action(0, "resize", 0, 1, 0, 1, "");
	assertEquals(ok, true);
	assertEquals(g.board.length, 4);
});

Deno.test("action resize - aucun coin sélectionné: retourne false, board inchangé", () => {
	const g = makeGame();
	const [ok] = g.action(0, "resize", 0, 0, 0, 0, "");
	assertEquals(ok, false);
	assertEquals(g.board.length, 3);
});

// ─── action trap ─────────────────────────────────────────────────────────────

Deno.test("action trap - pose le piège en (x, y) avec redirect (opt1, opt2)", () => {
	const g = makeGame();
	const [ok] = g.action(0, "trap", 0, 0, 2, 2, "");
	assertEquals(ok, true);
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

Deno.test("action trap - case piège occupée: retourne false", () => {
	const g = makeGame();
	g.board[0][0] = "X";
	assertEquals(g.action(0, "trap", 0, 0, 2, 2, "")[0], false);
});

Deno.test("action trap - redirect hors bornes: retourne false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "trap", 0, 0, 99, 0, "")[0], false);
	assertEquals(g.action(0, "trap", 0, 0, 0, 99, "")[0], false);
});

Deno.test("action trap - position du piège hors bornes: retourne false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "trap", 99, 0, 1, 1, "")[0], false);
});

// ─── action nomad ────────────────────────────────────────────────────────────

Deno.test("action nomad - pose un nomad sur le bord", () => {
	const g = makeGame();
	const [ok] = g.action(0, "nomad", 0, 0, 1, 0, "X");
	assertEquals(ok, true);
	// tick ran after action: cooldown 1→0, nomad still at (0,0)
	assertEquals((g.board[0][0] as unknown as ttd.Nomad).kind, "nomad");
	assertEquals((g.board[0][0] as unknown as ttd.Nomad).content, "X");
	assertEquals((g.board[0][0] as unknown as ttd.Nomad).cooldown, 0);
});

Deno.test("action nomad - position intérieure: retourne false", () => {
	const g = makeGame();
	const [ok] = g.action(0, "nomad", 1, 1, 1, 0, "X");
	assertEquals(ok, false);
});

Deno.test("action nomad - direction diagonale: retourne false", () => {
	const g = makeGame();
	const [ok] = g.action(0, "nomad", 0, 0, 1, 1, "X");
	assertEquals(ok, false);
});

// ─── action immunity ─────────────────────────────────────────────────────────

Deno.test("action immunity - pose une immunité sur la case", () => {
	const g = makeGame();
	const [ok] = g.action(0, "immunity", 0, 0, 0, 0, "");
	assertEquals(ok, true);
	// tick ran after action: cooldown 2→1
	assertEquals((g.board[0][0] as unknown as ttd.Immunity).kind, "immunity");
	assertEquals((g.board[0][0] as unknown as ttd.Immunity).cooldown, 1);
});

Deno.test("action immunity - hors bornes: retourne false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "immunity", 99, 0, 0, 0, "")[0], false);
	assertEquals(g.action(0, "immunity", 0, 99, 0, 0, "")[0], false);
});

// ─── action virus ────────────────────────────────────────────────────────────

Deno.test("action virus - pose un virus sur la case", () => {
	const g = makeGame();
	const [ok] = g.action(0, "virus", 1, 1, 0, 0, "");
	assertEquals(ok, true);
	assertEquals((g.board[1][1] as unknown as ttd.Virus).kind, "virus");
});

Deno.test("action virus - hors bornes: retourne false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "virus", 99, 0, 0, 0, "")[0], false);
	assertEquals(g.action(0, "virus", 0, 99, 0, 0, "")[0], false);
});

// ─── interactions ─────────────────────────────────────────────────────────────

Deno.test("interaction - bombe détruit un piège (pas de cooldown)", () => {
	const g = makeGame();
	g.placeTrap(1, 0, 2, 2);
	g.applyBomb(1, 1);
	assertEquals(g.board[0][1], "");
});

Deno.test("interaction - immunity protège une case de la bombe", () => {
	const g = makeGame();
	g.board[0][1] = {kind: "immunity", cooldown: 1, content: "X"};
	g.applyBomb(1, 1);
	assertEquals((g.board[0][1] as unknown as ttd.Immunity).kind, "immunity");
});

Deno.test("interaction - resize après bomb: nouvelles dimensions correctes", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	g.applyBomb(1, 1);
	g.applyResize(true, false, true, false);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[0][0], "");
});

Deno.test("interaction - invert après placement de symbols et virus: virus inchangé", () => {
	const g = makeGame();
	g.placeSymbol(0, 0, "X");
	g.placeVirus(2, 0);
	g.applyInvert(1, 0); // invert row 0
	assertEquals(g.board[0][0], "O"); // X inverted
	assertEquals(g.board[0][2], {kind: "virus", content: ""}); // virus untouched
});
