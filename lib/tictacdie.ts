export type Role = "X" | "O";
export type Cell = Role | "";

export type Board = [
	[Cell, Cell, Cell],
	[Cell, Cell, Cell],
	[Cell, Cell, Cell]
];

export type Player = {
	name: string;
}; // class Player

export class Game {
	board: Board;
	p1: Player;
	p2: Player;

	constructor(p1: Player, p2: Player) {
		this.board = [
			["", "", ""],
			["", "", ""],
			["", "", ""]
		];
		this.p1 = p1; this.p2 = p2;
	}; // constructor

	applyMove(x: number, y: number, r: Role): boolean {
		if (this.board[y][x] != "") return false;
		this.board[y][x] = r;
		return true;
	}; // applyMove
}; // class Game
