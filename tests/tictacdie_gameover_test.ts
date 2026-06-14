import { assertEquals } from "jsr:@std/assert";
import * as ttd from "../shared/tictacdie.ts";

function makeGame(): ttd.Game {
	const g = new ttd.Game(0, "p1", "p2");
	g.turn = 1;
	return g;
}

// ─── isGameOver - basic ───────────────────────────────────────────────────────

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

// ─── isGameOver - special cells ───────────────────────────────────────────────

Deno.test("isGameOver - immunity wrapping X counts as X for row win", () => {
	const g = makeGame();
	g.board[0][0] = {kind: "immunity", cooldown: 2, content: "X"};
	g.board[0][1] = "X";
	g.board[0][2] = "X";
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - immunity wrapping O counts as O for win", () => {
	const g = makeGame();
	g.board[1][0] = {kind: "immunity", cooldown: 2, content: "O"};
	g.board[1][1] = "O";
	g.board[1][2] = "O";
	assertEquals(g.isGameOver(), 2);
});

Deno.test("isGameOver - immunity wrapping empty breaks win", () => {
	const g = makeGame();
	g.board[0][0] = {kind: "immunity", cooldown: 2, content: ""};
	g.board[0][1] = "X";
	g.board[0][2] = "X";
	assertEquals(g.isGameOver(), -1);
});

Deno.test("isGameOver - nested immunity resolves inner symbol", () => {
	// getCellSymbol recurses for immunity wrapping immunity
	const g = makeGame();
	const inner: ttd.Immunity = {kind: "immunity", cooldown: 1, content: "X"};
	g.board[0][0] = {kind: "immunity", cooldown: 2, content: inner};
	g.board[0][1] = "X";
	g.board[0][2] = "X";
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - nomad with content X contributes to row win", () => {
	const g = makeGame();
	g.board[0][0] = {kind: "nomad", cooldown: 1, dirx: 1, diry: 0, content: "X", old_content: ""};
	g.board[0][1] = "X";
	g.board[0][2] = "X";
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - nomad with content O contributes to column win", () => {
	const g = makeGame();
	g.board[0][2] = {kind: "nomad", cooldown: 0, dirx: 0, diry: 1, content: "O", old_content: ""};
	g.board[1][2] = "O";
	g.board[2][2] = "O";
	assertEquals(g.isGameOver(), 2);
});

Deno.test("isGameOver - virus with X content contributes to win", () => {
	const g = makeGame();
	g.board[0] = [{kind: "virus", content: "X"}, "X", "X"];
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - virus with empty content breaks win", () => {
	const g = makeGame();
	g.board[0] = [{kind: "virus", content: ""}, "X", "X"];
	assertEquals(g.isGameOver(), -1);
});

Deno.test("isGameOver - column win via immunity-wrapped symbols", () => {
	const g = makeGame();
	g.board[0][0] = {kind: "immunity", cooldown: 2, content: "X"};
	g.board[1][0] = "X";
	g.board[2][0] = "X";
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - anti-diagonal win via virus content", () => {
	const g = makeGame();
	g.board[0][2] = {kind: "virus", content: "O"};
	g.board[1][1] = "O";
	g.board[2][0] = "O";
	assertEquals(g.isGameOver(), 2);
});

// ─── isGameOver - resized board ───────────────────────────────────────────────

Deno.test("isGameOver - 4x4 board: 3-in-a-row is not a win", () => {
	// win requires all 4 cells in a line to match
	const g = makeGame();
	g.applyResize(true, false, true, false); // 3x3 → 4x4
	g.board[1][1] = "X"; g.board[1][2] = "X"; g.board[1][3] = "X";
	assertEquals(g.isGameOver(), -1);
});

Deno.test("isGameOver - 4x4 board: full row of X wins", () => {
	const g = makeGame();
	g.applyResize(true, false, true, false);
	g.board[1] = ["X", "X", "X", "X"];
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - 4x4 board: full column of O wins", () => {
	const g = makeGame();
	g.applyResize(false, true, false, true);
	for (let r = 0; r < 4; r++) g.board[r][2] = "O";
	assertEquals(g.isGameOver(), 2);
});

Deno.test("isGameOver - 4x4 board: main diagonal wins", () => {
	const g = makeGame();
	g.applyResize(true, false, true, false);
	for (let i = 0; i < 4; i++) g.board[i][i] = "X";
	assertEquals(g.isGameOver(), 1);
});

Deno.test("isGameOver - 4x4 board: anti-diagonal wins", () => {
	const g = makeGame();
	g.applyResize(true, false, true, false);
	for (let i = 0; i < 4; i++) g.board[3 - i][i] = "O";
	assertEquals(g.isGameOver(), 2);
});
