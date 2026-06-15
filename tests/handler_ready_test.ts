// handler_ready_test.ts – ready/unready toggling, game start, and game-map invariants.

import { assertEquals } from "@std/assert";
import { WebSocket } from "npm:ws";
import * as handler from "../handler.ts";
import * as msg from "../shared/protocol.ts";

type MockWs = {
	send: (data: unknown) => void;
	close: () => void;
	received: unknown[];
	closed: boolean;
};

function mockWs(): MockWs {
	const ws: MockWs = {
		received: [],
		closed: false,
		send(data: unknown) {
			ws.received.push(typeof data === "string" ? JSON.parse(data) : data);
		},
		close() { ws.closed = true; },
	};
	return ws;
}

function last(ws: MockWs): unknown {
	return ws.received[ws.received.length - 1];
}

function cast(mock: MockWs): WebSocket {
	return mock as unknown as WebSocket;
}

// ─── ready ───────────────────────────────────────────────────────────────────

Deno.test("ready - not in lobby sends ko", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.ready(cast(a));
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "ko");
});

Deno.test("ready - in lobby sends ok", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(b));
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ok");
});

Deno.test("ready - toggling back to unready prevents game from starting", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(a)); // toggles back to unready
	handler.ready(cast(b));
	assertEquals(handler.getState(cast(a)), "lobby");
	assertEquals(handler.getState(cast(b)), "lobby");
});

Deno.test("ready - both players ready: start broadcast sent to both", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b));
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "start");
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "start");
});

Deno.test("ready - both players enter 'game' state after start", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b));
	assertEquals(handler.getState(cast(a)), "game");
	assertEquals(handler.getState(cast(b)), "game");
});

Deno.test("ready - start message carries seed, player1, player2 fields", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b));
	const m = last(a) as { type: string; seed: number; player1: string; player2: string };
	assertEquals(m.type, "start");
	assertEquals(typeof m.seed, "number");
	assertEquals(typeof m.player1, "string");
	assertEquals(typeof m.player2, "string");
});

Deno.test("ready - ingame lobby is hidden from lobby list", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b));
	handler.register(cast(c), "charlie");
	const m = last(c) as { type: string; lobbies: msg.LobbyView[] };
	assertEquals(m.lobbies.some((l) => l.id === "lobby-1"), false);
});

Deno.test("ready - starting game in lobby-1 does not hide lobby-2 from list", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	const d = mockWs();
	const e = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.register(cast(d), "dan");
	handler.create(cast(a), "lobby-1");
	handler.create(cast(c), "lobby-2");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b)); // lobby-1 goes ingame
	handler.register(cast(e), "eve");
	const m = last(e) as { type: string; lobbies: msg.LobbyView[] };
	assertEquals(m.lobbies.some((l) => l.id === "lobby-1"), false);
	assertEquals(m.lobbies.some((l) => l.id === "lobby-2"), true);
});

// ─── GAMES map invariants ─────────────────────────────────────────────────────

Deno.test("games map - game entry created after both players ready", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b));
	// both in game state proves a game entry was created and linked
	assertEquals(handler.getState(cast(a)), "game");
	assertEquals(handler.getState(cast(b)), "game");
});

Deno.test("games map - two concurrent games coexist independently", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	const d = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.register(cast(d), "dan");
	handler.create(cast(a), "lobby-1");
	handler.create(cast(c), "lobby-2");
	handler.join(cast(b), "lobby-1");
	handler.join(cast(d), "lobby-2");
	handler.ready(cast(a));
	handler.ready(cast(b));
	handler.ready(cast(c));
	handler.ready(cast(d));
	assertEquals(handler.getState(cast(a)), "game");
	assertEquals(handler.getState(cast(b)), "game");
	assertEquals(handler.getState(cast(c)), "game");
	assertEquals(handler.getState(cast(d)), "game");
});

Deno.test("games map - unrelated players are not placed in game state", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b));
	// c registered but never joined a lobby
	assertEquals(handler.getState(cast(c)), "lobby");
});

Deno.test("games map - ingame lobby flag prevents a third join", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b));
	handler.join(cast(c), "lobby-1");
	assertEquals((last(c) as msg.ServerLobbyMessage).type, "ko");
});
