import { Symbol, Cell } from './tictacdie.ts'

export type ClientLobbyMessage =
	| {type: "signin", name: string}
	| {type: "create", id: string}
	| {type: "join", id: string}
	| {type: "ready"}
	| {type: "leave"};

export type LobbyView = {id: string, players: string[]}
export type ServerLobbyMessage =
	| {type: "lobbies", lobbies: LobbyView[]}
	| {type: "ok"}
	| {type: "ko", message: string}
	| {type: "start", seed: number, player1: string, player2: string}
	| {type: "closing"};

export type ClientGameMessage = {
	type: "action",
	card: "invert" | "resize" | "bomb" | "symbol" | "nomad" | "immunity" | "virus" | "trap" | "ttt",
	player: number,
	x: number, y: number,
	opt1: number, opt2: number, opt3: string
};

export type ServerGameMessage =
	| {type: "gameover", result: number} // 0:draw; 1:player1, 2:player2 
	| {type: "ok"}
	| {type: "closing"}
	| {
		type: "ko", message: string, board: Cell[][], turn: number,
		p1: {name: string, symbol: Symbol, jokers: string[]},
		p2: {name: string, symbol: Symbol, jokers: string[]}
	};
