import { assertEquals } from "jsr:@std/assert";
import { Role, Cell, Board, Player, Game } from "./tictacdie.ts";

Deno.test("init game", () => {
	const g = new Game({name:"player1"}, {name:"player2"});	

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

Deno.test("applyMove", () => {
	const g = new Game({name:"player1"}, {name:"player2"});	

	let res = g.applyMove(0, 0, "X");
	assertEquals(res, true);
	assertEquals(g.board[0][0], "X");

	res = g.applyMove(0, 0, "O");
	assertEquals(res, false);
	assertEquals(g.board[0][0], "X");

	res = g.applyMove(0, 0, "X");
	assertEquals(res, false);

	res = g.applyMove(1, 2, "X");
	assertEquals(res, true);
	assertEquals(g.board[2][1], "X");

	res = g.applyMove(2, 0, "O");
	assertEquals(res, true);
	assertEquals(g.board[0][2], "O");
	
});
