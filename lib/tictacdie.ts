export type Role = "X" | "O";
export type Cell = Role | "";

export type Board = [
	[Cell, Cell, Cell],
	[Cell, Cell, Cell],
	[Cell, Cell, Cell]
];

class Player {
	name!: string;
}; // class Player

class Game {
	board: Board;
	p1: Player;
	p2: Player;

	applyMove(x: int, y: int, r: Role): bool {}; // applyMove
}; // class Game
