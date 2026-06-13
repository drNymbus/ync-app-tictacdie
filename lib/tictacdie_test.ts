import { assertEquals } from "jsr:@std/assert";
import * as ttd from "./tictacdie.ts";

Deno.test("init game", () => {
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
