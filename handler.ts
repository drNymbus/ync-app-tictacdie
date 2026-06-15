import { WebSocket } from "npm:ws";
import * as msg from "./shared/protocol.ts";
import * as ttd from "./shared/tictacdie.ts";

type Player = {id: number, name: string, lobby: string, ready: boolean, game: number}
type Lobby = {id: string, ingame: boolean, players: WebSocket[]}
type Game = {id: number, game: ttd.Game, player1: WebSocket, player2: WebSocket}

let playerId = 0;
const PLAYERS = new Map<WebSocket, Player>();
const LOBBIES = new Map<string, Lobby>();
let gameId = 0;
const GAMES = new Map<number, Game>();
export function _resetForTest() {
	PLAYERS.clear();
	LOBBIES.clear();
	GAMES.clear();
}

function sendLobbies(ws: WebSocket) {
	let lobbies = [];
	for (const [key, lobby] of LOBBIES) {
		if (!lobby.ingame) {
			let player_names = [];
			for (const ws of lobby.players) {
				const p = PLAYERS.get(ws);
				if (!p) continue;
				player_names.push(p.name);
			}
			lobbies.push({id: lobby.id, players: player_names} as msg.LobbyView);
		}
	}
	ws.send(JSON.stringify({type: "lobbies", lobbies: lobbies} as msg.ServerLobbyMessage));
} // sendLobbies

function broadcastLobbies() {
	for (const [ws, player] of PLAYERS) {
		if (player.lobby === "") sendLobbies(ws);
	}
}

export function getState(ws: WebSocket): string {
	const player = PLAYERS.get(ws);
	if (!player) { return "register"; }

	if (player.lobby !== "" && player.ready && player.game !== -1) {
		return "game";
	} else {
		return "lobby";
	}
} // getState

export function register(ws: WebSocket, name: string) {
	try {
		const player = {id: playerId++, name: name, lobby: "", ready: false, game: -1} as Player;
		PLAYERS.set(ws, player);
		sendLobbies(ws);
	} catch (e) {
		if (e instanceof Error) {
			console.error(e.message);
		} else { console.error(e); }
		error(ws, "Internal error");
	}
} // register

export function create(ws: WebSocket, id: string) {
	try {
		LOBBIES.set(id, {id: id, ingame: false, players: [ws]} as Lobby);

		let p = PLAYERS.get(ws);
		if (!p) return close(ws);
		p.lobby = id;
		PLAYERS.set(ws, p);

		ws.send(JSON.stringify({type: "ok"} as msg.ServerLobbyMessage));
		broadcastLobbies();
	} catch (e) {
		if (e instanceof Error) {
			console.error(e.message);
		} else { console.error(e); }
		error(ws, "Internal error");
	}
} // create

export function join(ws: WebSocket, id: string) {
	try {
		let player = PLAYERS.get(ws);
		if (!player) return close(ws);
		if (player.lobby !== "") return error(ws, "Already in lobby");

		let lobby = LOBBIES.get(id);
		if (!lobby) return error(ws, "Invalid lobby ID");
		if (lobby.players.length > 1) return error(ws, "Lobby is full");
		if (lobby.ingame) return error(ws, "Game has already started");
		
		lobby.players.push(ws);
		LOBBIES.set(id, lobby);

		player.lobby = id;
		player.ready = false;
		player.game = -1;
		PLAYERS.set(ws, player);
		
		ws.send(JSON.stringify({type: "ok"} as msg.ServerLobbyMessage));
		broadcastLobbies();
	} catch (e) {
		if (e instanceof Error) {
			console.error(e.message);
		} else { console.error(e); }
		error(ws, "Internal error");
	}
} // join

function isLobbyReady(id: string): boolean {
	const lobby = LOBBIES.get(id);
	if (!lobby) return false;
	if (lobby.players.length !== 2) return false;

	let ready = true;
	for (const ws of lobby.players) {
		const p = PLAYERS.get(ws);
		if (!p) return false;
		ready = ready && p.ready
	}

	lobby.ingame = ready;
	LOBBIES.set(id, lobby);
	return ready;
} // isLobbyReady

function broadcastStart(id: string) {
	const lobby = LOBBIES.get(id);
	if (!lobby) return;

	const seed = 0;
	let player1, player2;

	for (const ws of lobby.players) {
		const p = PLAYERS.get(ws);
		if (!p) close(ws);
		if (player1 === undefined) {
			player1 = p?.name;
		} else { player2 = p?.name; }
	}

	if (player1 === undefined || player2 === undefined) return;
	try {
		const gId = gameId++;
		GAMES.set(gId, {
			id: gId,
			game: new ttd.Game(seed, player1, player2),
			player1: lobby.players[0],
			player2: lobby.players[1]
		});
		for (const ws of lobby.players) {
			let p = PLAYERS.get(ws);
			if (!p) return close(ws);

			p.game = gId;
			PLAYERS.set(ws, p);

			ws.send(JSON.stringify({type: "start", seed: seed, player1: player1, player2: player2} as msg.ServerLobbyMessage));
		}
		broadcastLobbies();
	} catch (e) {
		if (e instanceof Error) {
			console.error(e.message);
		} else { console.error(e); }
		for (const ws of lobby.players) { error(ws, "Internal error"); }
	}
} // broadcastReady

export function ready(ws: WebSocket) {
	try {
		let player = PLAYERS.get(ws);
		if (!player) return close(ws);
		if (player.lobby === "") return error(ws, "Cannot set ready and not be in a lobby");

		player.ready = !player.ready;
		PLAYERS.set(ws, player);

		ws.send(JSON.stringify({type: "ok"} as msg.ServerLobbyMessage));
		if (isLobbyReady(player.lobby)) broadcastStart(player.lobby);
	} catch (e) {
		if (e instanceof Error) {
			console.error(e.message);
		} else { console.error(e); }
		error(ws, "Internal error");
	}
} // ready

export function leave(ws: WebSocket) {
	try {
		let player = PLAYERS.get(ws);
		if (!player) return close(ws);

		let lobby = LOBBIES.get(player.lobby);
		if (lobby) {
			const idx = lobby.players.indexOf(ws);
			lobby.players.splice(idx, 1);
			LOBBIES.set(player.lobby, lobby);
		}

		player.lobby = "";
		player.ready = false;
		PLAYERS.set(ws, player);
		broadcastLobbies();
	} catch (e) {
		if (e instanceof Error) {
			console.error(e.message);
		} else { console.error(e); }
		error(ws, "Internal error");
	}
} // leave

export function action(ws: WebSocket, action: msg.ClientGameMessage) {
	const p = PLAYERS.get(ws);
	if (!p) return close(ws);

	const game = GAMES.get(p.game);
	if (!game) return error(ws, "Game does not exists");

	if (action.player !== 1 && action.player !== 2) return error(ws, "Wrong player information given");

	const [ok, err] = game.game.action(action.player-1, action.card, action.x, action.y, action.opt1, action.opt2, action.opt3);
	if (!ok) return error(ws, err);
	ws.send(JSON.stringify({type: "ok"}));

	const action_msg = {
		type: "action",
		card: action.card,
		player: action.player,
		x: action.x, y: action.y,
		opt1: action.opt1, opt2: action.opt2, opt3: action.opt3
	} as msg.ClientGameMessage

	if (action.player === 1) {
		game.player2.send(JSON.stringify(action_msg));
	} else if (action.player === 2) {
		game.player1.send(JSON.stringify(action_msg));
	}

	const over = game.game.isGameOver();
	const gameover_msg = {type: "gameover", result: over} as msg.ServerGameMessage;
	game.player1.send(JSON.stringify(gameover_msg));
	game.player2.send(JSON.stringify(gameover_msg));

	if (over !== -1) {
		const p1 = PLAYERS.get(game.player1);
		if (!p1) return close(game.player1);
		p1.game = -1;
		PLAYERS.set(game.player1, p1);

		const p2 = PLAYERS.get(game.player2);
		if (!p2) return close(game.player2);
		p2.game = -1;
		PLAYERS.set(game.player2, p2);

		GAMES.delete(p.game);
	}
} // action

export function error(ws: WebSocket, msg: string) {
	const state = getState(ws);
	if (state === "lobby" || state === "register") {
		return ws.send(JSON.stringify({type: "ko", message: msg} as msg.ServerLobbyMessage));
	} else if (state === "game") {
		let player = PLAYERS.get(ws);
		if (!player) return close(ws);
		const game = GAMES.get(player.game);
		if (!game) return close(ws);
		return ws.send(JSON.stringify({type: "ko", message: msg, board: game.game.board} as msg.ServerGameMessage));
	}
} // error

export function close(ws: WebSocket) {
	// PLAYERS.delete(ws);

	ws.send(JSON.stringify({type: "closing"}));
	ws.close();
} // close
