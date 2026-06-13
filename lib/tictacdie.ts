export type Empty = "";
export type Symbol = "X" | "O";

export type Nomad = {kind: "nomad", cooldown: number, dirx: number, diry: number, content: Symbol, old_content: Cell};
export type Immunity = {kind: "immunity", cooldown: number, content: Cell};
export type Trap = {kind: "trap", newx: number, newy: number};
export type Virus = {kind: "virus", content: Empty | Symbol};
export type TTT = {kind: "ttt"}; // TODO

export type Cell = Empty | Symbol | Nomad | Immunity | Trap | Virus | TTT;
	
export type Player = {
	name: string;
}; // class Player

export class Game {
	board: Cell[][];
	turn: number;
	p1: Player;
	p2: Player;

	constructor(p1: Player, p2: Player) {
		this.board = [
			["", "", ""],
			["", "", ""],
			["", "", ""]
		];
		this.p1 = p1; this.p2 = p2;
		this.turn = 1;
	}; // constructor

	tick() {
		// console.log("START", this.board);
		for (let j=0; j < this.board.length; j++) {
			for (let i=0; i < this.board[0].length; i++) {
				let cell = this.board[j][i];

				if (typeof cell === "object") {
					if (cell.kind === "nomad") {
						if (cell.cooldown >= 0) cell.cooldown--;
						if (cell.cooldown < 0) {
							this.board[j][i] = cell.old_content;

							const newx = i + cell.dirx, newy = j + cell.diry;
							if ((newx >= 0 && newx < this.board[0].length) && (newy >= 0 && newy < this.board.length)) {
								cell.old_content = this.board[newy][newx];
								this.board[newy][newx] = cell;
							} 
							if (cell.dirx > 0 || cell.diry > 0) cell.cooldown = 1;
						}

					} else if (cell.kind === "immunity") {
						cell.cooldown--;
						if (cell.cooldown < 0) this.board[j][i] = cell.content;

					} else if (cell.kind === "virus") {
						let countX = 0, countO = 0;

						const cross = [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]];
						for (const [dy, dx] of cross) {
							if (i + dx >= 0 && i + dx < this.board[0].length
							    	&& j + dy >= 0 && j + dy < this.board.length) {
								if (this.board[j + dy][i + dx] === "X") countX++;
								if (this.board[j + dy][i + dx] === "O") countO++;
							}
						}
						if (countX > countO) {
							cell.content = "X";
						} else if (countX < countO) {
							cell.content = "O";
						} else { cell.content = ""; }

					} else if (cell.kind === "ttt") {
					}
				}

			}
		}
		// console.log("END", this.board);
	}; // tick	

	// -1: not over; 0: draw; 1: player1; 2: player2
	isGameOver(): number {
		return -1;
	}; // isGameOver

	action(player_index: number, card: string, x: number, y:number, opt1: number, opt2: number, opt3: string): [boolean, string] {
		if (player_index !== 1 - this.turn%2) return [false, "not your turn"]; // not your turn
		// if (x < 0 || x > this.board[0].length-1) return [false, "invalid x position"];
		// if (y < 0 || y > this.board.length-1) return [false, "invalid y position"];

		let res = false;
		let message = "";

		if (card === "invert") {
			res = this.applyInvert(x, y);
			message = "invert";

		} else if (card === "resize") {
			res = this.applyResize(x === 1, y === 1, opt1 === 1, opt2 === 1);
			message = "resize";

		} else if (card === "bomb") {
			res = this.applyBomb(x, y);
			message = "bomb";

		} else if (card === "symbol") {
			let symbol;
			if (opt1 === 0) symbol = "X" as Symbol;
			if (opt1 === 1) symbol = "O" as Symbol;

			if (symbol === undefined) return [false, "(symbol) invalid dirx parameter"];
			res = this.placeSymbol(x, y, symbol);
			message = "symbol";

		} else if (card === "nomad") {
			res = this.placeNomad(x, y, opt1, opt2, opt3 as Symbol);
			message = "nomad";

		} else if (card === "immunity") {
			res = this.placeImmunity(x, y);
			message = "immunity";

		} else if (card === "trap") {
			res = this.placeTrap(x, y, opt1, opt2);
			message = "trap";

		} else if (card === "virus") {
			res = this.placeVirus(x, y);
			message = "virus";

		} else if (card === "ttt") {
			res = true;
			message = "ttt";
		}

		this.tick();
		return [res, message];
	} // action

	applyInvert(row: number, index: number): boolean {
		if (row !== 0 && row !== 1) return false;
		if (row === 1 && (index < 0 || index > this.board[0].length)) return false;
		if (row === 0 && (index < 0 || index > this.board.length)) return false;
		
		if (row === 1) {
			for (let x=0; x < this.board[0].length; x++) {
				let cell = this.board[index][x];
				if (typeof cell === "object" && cell.kind === "nomad") {
					cell.content = (cell.content === "X") ? "O" : "X";
					cell.old_content = (cell.old_content === "X") ? "O" : "X";
				} else if (typeof cell === "string" && cell !== "") {
					cell = (cell === "X") ? "O" : "X";
				}
				this.board[index][x] = cell;
			}
		} else {
			for (let y=0; y < this.board.length; y++) {
				let cell = this.board[y][index];
				if (typeof cell === "object" && cell.kind === "nomad") {
					cell.content = (cell.content === "X") ? "O" : "X";
					cell.old_content = (cell.old_content === "X") ? "O" : "X";
				} else if (typeof cell === "string" && cell !== "") {
					cell = (cell === "X") ? "O" : "X";
				}
				this.board[y][index] = cell;
			}
		}
		return true;
	}; // applyInvert
	
	applyResize(top: boolean, bottom: boolean, left: boolean, right: boolean): boolean {
		if (!(top || bottom) || !(left || right)) return false;

		const rowOffset = top ? 1 : 0;
		const colOffset = left ? 1 : 0;
		const oldRows = this.board.length;
		const oldCols = this.board[0].length;
		const newBoard: Cell[][] = Array.from({ length: oldRows + 1 }, () =>
		    Array(oldCols + 1).fill("") as Cell[]
		);
		for (let r = 0; r < oldRows; r++) {
		    for (let c = 0; c < oldCols; c++) {
			newBoard[r + rowOffset][c + colOffset] = this.board[r][c];
		    }
		}
		this.board = newBoard;	

		return true;
	}; // applyResize
	
	applyBomb(x: number, y: number): boolean {
		if (x < 0 || x > this.board[0].length) return false;
		if (y < 0 || y > this.board.length) return false;

		const cross = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
		for (const [dy, dx] of cross) {
		    const ny = y + dy;
		    const nx = x + dx;
		    if (ny < 0 || ny >= this.board.length) continue;
		    if (nx < 0 || nx >= this.board[0].length) continue;
		    const cell = this.board[ny][nx];
		    if (typeof cell === "object" && "cooldown" in cell) continue;
		    this.board[ny][nx] = "";
		}

		return true;
	}; // applyBomb

	placeSymbol(x: number, y: number, s: Symbol): boolean {
		if (x < 0 || x > this.board[0].length) return false;
		if (y < 0 || y > this.board.length) return false;

		const cell = this.board[y][x];
		if (typeof cell === "object" && cell.kind === "trap") {
			if (this.board[cell.newy][cell.newx] === "") {
				this.board[y][x] = "";
				this.board[cell.newy][cell.newx] = s;
			} else {
				this.board[y][x] = s;
			}
		} else if (typeof cell === "string" && cell === "") {
			this.board[y][x] = s;
		} else { return false; }
		return true;
	}; // placeSymbol

	placeNomad(x: number, y: number, dirx: number, diry: number, s: Symbol): boolean {
		if (x !== 0 && x !== this.board[0].length-1 && y !== 0 && y !== this.board.length-1) return false;
		if ((diry === 0 && dirx !== -1 && dirx !== 1) || (dirx === 0 && diry !== -1 && diry !== 1)) return false;

		const content = this.board[y][x];
		this.board[y][x] = {kind: "nomad", cooldown: 1, dirx: dirx, diry: diry, content: s, old_content: content};
		return true;
	}; // placeNomad

	placeImmunity(x: number, y: number): boolean {
		if (x < 0 || x > this.board[0].length-1) return false;
		if (y < 0 || y > this.board.length-1) return false;

		const content = this.board[y][x];
		this.board[y][x] = {kind: "immunity", cooldown: 2, content: content};
		return true;
	}; // placeImmunity

	placeVirus(x: number, y: number): boolean {
		if (x < 0 || x > this.board[0].length-1) return false;
		if (y < 0 || y > this.board.length-1) return false;
		this.board[y][x] = {kind: "virus", content: ""};
		return true;
	}; // placeVirus
	
	placeTrap(x: number, y: number, ax: number, ay: number): boolean {
		if (x < 0 || x >= this.board[0].length) return false;
		if (y < 0 || y >= this.board.length) return false;
		if (ax < 0 || ax >= this.board[0].length) return false;
		if (ay < 0 || ay >= this.board.length) return false;
		if (this.board[y][x] !== "") return false;

		this.board[y][x] = {kind: "trap", newx: ax, newy: ay};
		return true;
	}; // placeTrap

	placeTTT(x: number, y: number) {}; // placeTTT
}; // class Game
