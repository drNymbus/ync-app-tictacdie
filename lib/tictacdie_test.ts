import { assertEquals } from "@std/assert";
import { Game } from "./tictacdie.ts";

function makeGame(): Game {
  return new Game({ name: "p1" }, { name: "p2" });
}

// ─── applyInvert ────────────────────────────────────────────────────────────

Deno.test("applyInvert - row: X et O s'inversent", () => {
  const g = makeGame();
  g.board[0] = ["X", "O", "X"];
  g.applyInvert(0,0);
  assertEquals(g.board[0], ["O", "X", "O"]);
});

Deno.test("applyInvert - row: les cases vides restent vides", () => {
  const g = makeGame();
  g.board[1] = ["X", "", "O"];
  g.applyInvert(0,1);
  assertEquals(g.board[1], ["O", "", "X"]);
});

Deno.test("applyInvert - col: X et O s'inversent sur la colonne", () => {
  const g = makeGame();
  g.board[0][0] = "X";
  g.board[1][0] = "O";
  g.board[2][0] = "X";
  g.applyInvert(1,0);
  assertEquals(g.board[0][0], "O");
  assertEquals(g.board[1][0], "X");
  assertEquals(g.board[2][0], "O");
});

Deno.test("applyInvert - une case immune n'est pas affectée", () => {
  const g = makeGame();
  g.board[0] = [{ cooldown: 2, content: "X" }, "O", "X"];
  g.applyInvert(0,0);
  assertEquals(g.board[0][0], { cooldown: 2, content: "X" });
  assertEquals(g.board[0][1], "X");
  assertEquals(g.board[0][2], "O");
});

Deno.test("applyInvert - index hors bornes retourne false", () => {
  const g = makeGame();
  assertEquals(g.applyInvert(0,99), false);
  assertEquals(g.applyInvert(1,99), false);
});

Deno.test("applyInvert - nomad: content et old_content s'inversent tous les deux", () => {
  const g = makeGame();
  g.board[0][1] = { dirx: 1, diry: 0, content: "X", old_content: "O" };
  g.applyInvert(0,0);
  assertEquals(g.board[0][1], { dirx: 1, diry: 0, content: "O", old_content: "X" });
});

Deno.test("applyInvert - nomad avec old_content vide: old_content reste vide", () => {
  const g = makeGame();
  g.board[0][1] = { dirx: 1, diry: 0, content: "X", old_content: "" };
  g.applyInvert(0,0);
  assertEquals(g.board[0][1], { dirx: 1, diry: 0, content: "O", old_content: "" });
});

Deno.test("applyInvert - virus: case virus inchangée, les autres cases de la row s'inversent", () => {
  const g = makeGame();
  g.board[0] = [{ content: "X" }, "X", "O"];
  g.applyInvert(0,0);
  assertEquals(g.board[0][0], { content: "X" }); // virus inchangé
  assertEquals(g.board[0][1], "O");
  assertEquals(g.board[0][2], "X");
});

Deno.test("applyInvert - TTT: case inchangée", () => {
  const g = makeGame();
  g.board[0] = [{}, "X", "O"];
  g.applyInvert(0,0);
  assertEquals(g.board[0][0], {});
  assertEquals(g.board[0][1], "O");
  assertEquals(g.board[0][2], "X");
});

Deno.test("applyInvert - trap: case inchangée", () => {
  const g = makeGame();
  g.board[0][0] = { newx: 2, newy: 1 };
  g.applyInvert(0, 0);
  assertEquals(g.board[0][0], { newx: 2, newy: 1 });
});

// ─── placeTrap / placeSymbol (trap) / tick (caduc) ─────────────────────────

Deno.test("placeTrap - pose normale sur case vide", () => {
  const g = makeGame();
  assertEquals(g.placeTrap(0, 0, 2, 2), true);
  assertEquals(g.board[0][0], { newx: 2, newy: 2 });
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
  assertEquals(g.board[0][0], { newx: 2, newy: 2 });
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
  assertEquals(g.board[0][0], "");
});

Deno.test("tick - piège reste actif si la redirect est vide", () => {
  const g = makeGame();
  g.placeTrap(0, 0, 2, 2);
  g.tick();
  assertEquals(g.board[0][0], { newx: 2, newy: 2 });
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
  g.board[1][1] = { cooldown: 2, content: "X" };
  g.applyResize(true, false, true, false); // haut-gauche: décalage bas-droite
  assertEquals(g.board[2][2], { cooldown: 2, content: "X" });
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
  g.board[0][1] = { cooldown: 2, content: "X" };
  g.applyBomb(1, 1);
  assertEquals(g.board[0][1], { cooldown: 2, content: "X" }); // inchangée
  assertEquals(g.board[1][1], ""); // centre détruit normalement
});

Deno.test("applyBomb - centre immune: la bombe s'active quand même, seuls les voisins sont détruits", () => {
  const g = makeGame();
  g.board = [
    ["X", "O", "X"],
    ["O", { cooldown: 3, content: "X" }, "O"],
    ["X", "O", "X"],
  ];
  g.applyBomb(1, 1);
  assertEquals(g.board[1][1], { cooldown: 3, content: "X" }); // centre immune inchangé
  assertEquals(g.board[0][1], ""); // haut détruit
  assertEquals(g.board[2][1], ""); // bas détruit
  assertEquals(g.board[1][0], ""); // gauche détruit
  assertEquals(g.board[1][2], ""); // droite détruit
  assertEquals(g.board[0][0], "X"); // coins hors croix inchangés
});
