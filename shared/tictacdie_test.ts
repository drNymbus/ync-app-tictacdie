import { assertEquals } from "jsr:@std/assert";
import * as ttd from "./tictacdie.ts";

function makeGame(): ttd.Game {
	return new ttd.Game({ name: "p1" }, { name: "p2" });
}

Deno.test("init Game", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	

	assertEquals(g.board.length, 3);
	assertEquals(g.board[0].length, 3);
	assertEquals(g.board[1].length, 3);
	assertEquals(g.board[2].length, 3);

	for (let j=0; j < g.board.length; j++) {
		for (let i=0; i < g.board[j].length; i++) {
			assertEquals(g.board[j][i], "");
		}
	}
});

Deno.test("applyInvert", () => {
	const g = makeGame();
	g.placeSymbol(0, 0, "X");
	g.placeSymbol(2, 0, "O");
	g.applyInvert(1, 0);
	assertEquals(g.board[0], ["O", "", "X"]);

	const g2 = makeGame();
	g2.placeSymbol(1, 0, "X");
	g2.placeSymbol(0, 0, "O");
	g2.placeNomad(0, 0, 1, 0, "X");
	g2.placeImmunity(1, 0);
	g2.applyInvert(0, 0);
	assertEquals(g2.board[0], [{kind: "nomad", cooldown:1, dirx:1, diry:0, content:"O", old_content: "X"}, {kind: "immunity", cooldown: 2, content: "X"}, ""]);
});

Deno.test("placeSymbol", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[0][0], "X");

	g.placeSymbol(2, 1, "O");
	assertEquals(g.board[1][2], "O");
});

Deno.test("placeNomad", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	

	g.placeNomad(0, 0, 1, 0, "X");
	g.tick();
	assertEquals(g.board[0][0], {kind: "nomad", cooldown: 0, dirx:1, diry:0, content: "X", old_content: ""});
	g.tick();
	assertEquals(g.board[0][1], {kind: "nomad", cooldown: 0, dirx:1, diry:0, content: "X", old_content: ""});
	g.tick();
	g.tick();
	assertEquals(g.board[0][2], "");

	g.placeSymbol(1, 1, "O");
	g.placeNomad(1, 2, 0, -1, "X");
	g.tick();
	assertEquals(g.board[2][1], {kind: "nomad", cooldown: 0, dirx:0, diry:-1, content:"X", old_content: ""});
	g.tick();
	assertEquals(g.board[1][1], {kind: "nomad", cooldown: -1, dirx:0, diry:-1, content:"X", old_content: "O"});
	g.tick();
	g.tick();
	assertEquals(g.board[0][1], "");
});

Deno.test("placeImmunity", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	
	
	g.placeImmunity(0, 0);
	assertEquals(g.board[0][0], {kind: "immunity", cooldown:2, content: ""});
	g.tick();
	assertEquals(g.board[0][0], {kind: "immunity", cooldown:1, content: ""});
	g.tick();
	g.tick();
	assertEquals(g.board[0][0], "");
});

Deno.test("placeVirus", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	

	g.placeVirus(0, 0);
	assertEquals(g.board[0][0], {kind: "virus", content: ""});

	g.placeSymbol(1, 0, "X");
	g.tick();
	assertEquals(g.board[0][0], {kind: "virus", content: "X"});

	g.placeSymbol(0, 1, "O");
	g.tick();
	assertEquals(g.board[0][0], {kind: "virus", content: ""});

	g.placeSymbol(1, 1, "O");
	g.tick();
	assertEquals(g.board[0][0], {kind: "virus", content: "O"});
});

// ─── placeTrap / placeSymbol (trap) / tick (caduc) ─────────────────────────

Deno.test("placeTrap - pose normale sur case vide", () => {
  const g = makeGame();
  assertEquals(g.placeTrap(0, 0, 2, 2), true);
  assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2 });
});

Deno.test("placeTrap - refuse si case piège occupée", () => {
  const g = makeGame();
  g.board[0][0] = "X";
  assertEquals(g.placeTrap(0, 0, 2, 2), false);
});

Deno.test("placeTrap - refuse si (x,y) hors bornes", () => {
  const g = makeGame();
  assertEquals(g.placeTrap(99, 0, 1, 1), false);
  assertEquals(g.placeTrap(0, 99, 1, 1), false);
});

Deno.test("placeTrap - refuse si redirect (ax,ay) hors bornes", () => {
  const g = makeGame();
  assertEquals(g.placeTrap(0, 0, 99, 1), false);
  assertEquals(g.placeTrap(0, 0, 1, 99), false);
});

Deno.test("placeTrap - redirect occupée à la pose est acceptée (check lazy)", () => {
  const g = makeGame();
  g.board[2][2] = "X";
  assertEquals(g.placeTrap(0, 0, 2, 2), true);
  assertEquals(g.board[0][0], { kind: "trap",newx: 2, newy: 2 });
});

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

Deno.test("tick - piège devient caduc si la redirect est occupée", () => {
  const g = makeGame();
  g.placeTrap(0, 0, 2, 2);
  g.board[2][2] = "O";
  g.tick();
  assertEquals(g.board[0][0], {kind: "trap", newx:2, newy: 2});
});

Deno.test("tick - piège reste actif si la redirect est vide", () => {
  const g = makeGame();
  g.placeTrap(0, 0, 2, 2);
  g.tick();
  assertEquals(g.board[0][0], { kind: "trap",newx: 2, newy: 2 });
});

// ─── applyResize ────────────────────────────────────────────────────────────

Deno.test("applyResize - coin haut-gauche: board passe en 4x4, contenu décalé bas-droite", () => {
  const g = makeGame();
  g.board[0][0] = "X";
  g.applyResize(true, false, true, false);
  assertEquals(g.board.length, 4);
  assertEquals(g.board[0].length, 4);
  assertEquals(g.board[1][1], "X"); // ancien [0][0] décalé d'une ligne et d'une colonne
  assertEquals(g.board[0][0], "");  // nouveau coin
});

Deno.test("applyResize - coin haut-droit: board passe en 4x4, contenu décalé vers le bas", () => {
  const g = makeGame();
  g.board[0][2] = "X";
  g.applyResize(true, false, false, true);
  assertEquals(g.board.length, 4);
  assertEquals(g.board[0].length, 4);
  assertEquals(g.board[1][2], "X"); // ancien [0][2] décalé d'une ligne seulement
  assertEquals(g.board[0][3], "");  // nouveau coin haut-droit
});

Deno.test("applyResize - coin bas-gauche: board passe en 4x4, contenu décalé vers la droite", () => {
  const g = makeGame();
  g.board[2][0] = "X";
  g.applyResize(false, true, true, false);
  assertEquals(g.board.length, 4);
  assertEquals(g.board[0].length, 4);
  assertEquals(g.board[2][1], "X"); // ancien [2][0] décalé d'une colonne seulement
  assertEquals(g.board[3][0], "");  // nouveau coin bas-gauche
});

Deno.test("applyResize - coin bas-droit: board passe en 4x4, contenu inchangé en position", () => {
  const g = makeGame();
  g.board[2][2] = "X";
  g.applyResize(false, true, false, true);
  assertEquals(g.board.length, 4);
  assertEquals(g.board[0].length, 4);
  assertEquals(g.board[2][2], "X"); // ancien [2][2] pas décalé
  assertEquals(g.board[3][3], "");  // nouveau coin bas-droit
});

Deno.test("applyResize - aucun coin sélectionné: board inchangé", () => {
  const g = makeGame();
  g.applyResize(false, false, false, false);
  assertEquals(g.board.length, 3);
  assertEquals(g.board[0].length, 3);
});

Deno.test("applyResize - les cellules complexes sont préservées et déplacées correctement", () => {
  const g = makeGame();
  g.board[1][1] = {kind: "immunity", cooldown: 2, content: "X" };
  g.applyResize(true, false, true, false); // haut-gauche: décalage bas-droite
  assertEquals(g.board[2][2], {kind: "immunity", cooldown: 2, content: "X" });
});

// ─── applyBomb ──────────────────────────────────────────────────────────────

Deno.test("applyBomb - centre (1,1): détruit la case et la croix", () => {
  const g = makeGame();
  g.board = [
    ["X", "O", "X"],
    ["O", "X", "O"],
    ["X", "O", "X"],
  ];
  g.applyBomb(1, 1);
  assertEquals(g.board[1][1], ""); // centre
  assertEquals(g.board[0][1], ""); // haut
  assertEquals(g.board[2][1], ""); // bas
  assertEquals(g.board[1][0], ""); // gauche
  assertEquals(g.board[1][2], ""); // droite
  assertEquals(g.board[0][0], "X"); // coins non affectés
  assertEquals(g.board[2][2], "X");
});

Deno.test("applyBomb - coin (0,0): seulement les voisins valides détruits", () => {
  const g = makeGame();
  g.board = [
    ["X", "O", "X"],
    ["O", "X", "O"],
    ["X", "O", "X"],
  ];
  g.applyBomb(0, 0);
  assertEquals(g.board[0][0], ""); // centre
  assertEquals(g.board[0][1], ""); // droite
  assertEquals(g.board[1][0], ""); // bas
  assertEquals(g.board[1][1], "X"); // hors croix, non affecté
});

Deno.test("applyBomb - bord haut (1,0): voisins valides détruits, pas de crash hors plateau", () => {
  const g = makeGame();
  g.board = [
    ["X", "O", "X"],
    ["O", "X", "O"],
    ["X", "O", "X"],
  ];
  g.applyBomb(1, 0);
  assertEquals(g.board[0][1], ""); // centre
  assertEquals(g.board[0][0], ""); // gauche
  assertEquals(g.board[0][2], ""); // droite
  assertEquals(g.board[1][1], ""); // bas
});

Deno.test("applyBomb - une case immune dans la croix n'est pas détruite", () => {
  const g = makeGame();
  g.board[0][1] = { kind: "immunity",cooldown: 2, content: "X" };
  g.applyBomb(1, 1);
  assertEquals(g.board[0][1], {kind:"immunity", cooldown: 2, content: "X" }); // inchangée
  assertEquals(g.board[1][1], ""); // centre détruit normalement
});

Deno.test("applyBomb - centre immune: la bombe s'active quand même, seuls les voisins sont détruits", () => {
  const g = makeGame();
  g.board = [
    ["X", "O", "X"],
    ["O", { kind: "immunity",cooldown: 3, content: "X" }, "O"],
    ["X", "O", "X"],
  ];
  g.applyBomb(1, 1);
  assertEquals(g.board[1][1], {kind:"immunity", cooldown: 3, content: "X" }); // centre immune inchangé
  assertEquals(g.board[0][1], ""); // haut détruit
  assertEquals(g.board[2][1], ""); // bas détruit
  assertEquals(g.board[1][0], ""); // gauche détruit
  assertEquals(g.board[1][2], ""); // droite détruit
  assertEquals(g.board[0][0], "X"); // coins hors croix inchangés
});

Deno.test("placeTTT", () => {});

/*
	tick() {}; // tick
	isGameOver(): number {}; // isGameOver

	applyInvert(row: number, column: number) {}; // applyInvert
	applyResize(top: boolean, bottom: boolean, left: boolean, right: boolean) {}; // applyResize
	applyBomb(x: number, y: number) {}; // applyBomb

	placeSymbol(x: number, y: number, s: Symbol) {}; // placeSymbol
	placeNomad(x: number, y: number, dirx: number, diry: number) {}; // placeNomad
	placeImmunity(x: number, y: number) {}; // placeImmunity
	placeVirus(x: number, y: number) {}; // placeVirus
	placeTrap(x: number, y: number, ax: number, ay: number) {}; // placeTrap
	placeTTT(x: number, y: number) {}; // placeTTT
*/

// ─── Validation générale ─────────────────────────────────────────────────────

Deno.test("action - jouer hors de son tour: retourne false", () => {
    const g = makeGame();
    const [ok] = g.action(1, "symbol", 0, 0, 0, 0, ""); // c'est le tour de 0
    assertEquals(ok, false);
});

Deno.test("action - player_index invalide: retourne false", () => {
    const g = makeGame();
    assertEquals(g.action(-1, "symbol", 0, 0, 0, 0, "")[0], false);
    assertEquals(g.action(2,  "symbol", 0, 0, 0, 0, "")[0], false);
});

Deno.test("action - carte inconnue: retourne false", () => {
    const g = makeGame();
    const [ok] = g.action(0, "joker_inexistant", 0, 0, 0, 0, "");
    assertEquals(ok, false);
});

// ─── Gestion des tours ───────────────────────────────────────────────────────

Deno.test("action - le tour passe à l'adversaire après un succès", () => {
    const g = makeGame();
    g.action(0, "symbol", 0, 0, 0, 0, "");
    const [ok] = g.action(1, "symbol", 1, 1, 0, 0, "O");
    assertEquals(ok, true);
    assertEquals(g.board[1][1], "O");
});

Deno.test("action - le tour ne passe pas après un échec", () => {
    const g = makeGame();
    g.action(0, "symbol", 0, 0, 0, 0, "O"); // échoue
    const [ok] = g.action(1, "symbol", 0, 0, 0, 0, "X"); // joueur 1 ne doit pas pouvoir jouer
    assertEquals(ok, false);
});

// ─── symbol ──────────────────────────────────────────────────────────────────

Deno.test("action symbol - player 0 pose X", () => {
    const g = makeGame();
    const [ok] = g.action(0, "symbol", 1, 1, 0, 0, "X");
    assertEquals(ok, true);
    assertEquals(g.board[1][1], "X");
});

Deno.test("action symbol - player 1 pose O", () => {
    const g = makeGame();
    g.action(0, "symbol", 0, 0, 0, 0, "O");
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
    assertEquals(g.action(0, "symbol", 99, 0,  0, 0, "")[0], false);
    assertEquals(g.action(0, "symbol", 0,  99, 0, 0, "")[0], false);
});

// ─── invert ──────────────────────────────────────────────────────────────────

Deno.test("action invert - row: inverse la ligne x", () => {
    const g = makeGame();
    g.board[0] = ["X", "O", "X"];
    const [ok] = g.action(0, "invert", 1, 0, 0, 0, ""); // axis=0 (row), index=x=0
    assertEquals(ok, true);
    assertEquals(g.board[0], ["O", "X", "O"]);
});

Deno.test("action invert - col: inverse la colonne x", () => {
    const g = makeGame();
    g.board[0][0] = "X"; g.board[1][0] = "O"; g.board[2][0] = "X";
    const [ok] = g.action(0, "invert", 0, 0, 1, 0, ""); // axis=1 (col), index=x=0
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

// ─── bomb ────────────────────────────────────────────────────────────────────

Deno.test("action bomb - vide la croix autour de (x, y)", () => {
    const g = makeGame();
    g.board = [
        ["X", "O", "X"],
        ["O", "X", "O"],
        ["X", "O", "X"],
    ];
    const [ok] = g.action(0, "bomb", 1, 1, 0, 0, "");
    assertEquals(ok, true);
    assertEquals(g.board[1][1], ""); // centre
    assertEquals(g.board[0][1], ""); // haut
    assertEquals(g.board[2][1], ""); // bas
    assertEquals(g.board[1][0], ""); // gauche
    assertEquals(g.board[1][2], ""); // droite
    assertEquals(g.board[0][0], "X"); // coins inchangés
});

Deno.test("action bomb - centre hors bornes: retourne false", () => {
    const g = makeGame();
    assertEquals(g.action(0, "bomb", 99, 0,  0, 0, "")[0], false);
    assertEquals(g.action(0, "bomb", 0,  99, 0, 0, "")[0], false);
});

// ─── resize ──────────────────────────────────────────────────────────────────

Deno.test("action resize - coin haut-gauche: board passe en 4x4", () => {
    const g = makeGame();
    // top=opt1=1, bottom=opt2=0, left=x=1, right=y=0
    const [ok] = g.action(0, "resize", 1, 0, 1, 0, "");
    assertEquals(ok, true);
    assertEquals(g.board.length, 4);
    assertEquals(g.board[0].length, 4);
});

Deno.test("action resize - coin bas-droit: board passe en 4x4", () => {
    const g = makeGame();
    // top=opt1=0, bottom=opt2=1, left=x=0, right=y=1
    const [ok] = g.action(0, "resize", 0, 1, 0, 1, "");
    assertEquals(ok, true);
    assertEquals(g.board.length, 4);
});

Deno.test("action resize - aucun coin sélectionné: retourne false", () => {
    const g = makeGame();
    const [ok] = g.action(0, "resize", 0, 0, 0, 0, "");
    assertEquals(ok, false);
    assertEquals(g.board.length, 3); // board inchangé
});

// ─── trap ────────────────────────────────────────────────────────────────────

Deno.test("action trap - pose le piège en (x, y) avec redirect (opt1, opt2)", () => {
    const g = makeGame();
    const [ok] = g.action(0, "trap", 0, 0, 2, 2, "");
    assertEquals(ok, true);
    assertEquals(g.board[0][0], { kind:"trap", newx: 2, newy: 2 });
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
