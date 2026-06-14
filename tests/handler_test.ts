// handler_test.ts – registration, state detection, error, and connection close.
// Lobby and game tests live in handler_lobby_test.ts, handler_ready_test.ts, handler_game_test.ts.

import { assertEquals } from "@std/assert";
import { WebSocket } from "npm:ws";
import * as handler from "../handler.ts";
import * as msg from "../shared/protocol.ts";

// handler.ts sends action_msg as a plain object (missing JSON.stringify) — accept unknown
type MockWs = {
	send: (data: unknown) => void;
	close: () => void;
	received: unknown[];
	closed: boolean;
};

export function mockWs(): MockWs {
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

export function last(ws: MockWs): unknown {
	return ws.received[ws.received.length - 1];
}

export function cast(mock: MockWs): WebSocket {
	return mock as unknown as WebSocket;
}

// ─── getState ────────────────────────────────────────────────────────────────

Deno.test("getState - unregistered socket is in 'register' state", () => {
	handler._resetForTest();
	const a = mockWs();
	assertEquals(handler.getState(cast(a)), "register");
});

Deno.test("getState - registered socket with no lobby is in 'lobby' state", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	assertEquals(handler.getState(cast(a)), "lobby");
});

Deno.test("getState - player inside a lobby (not yet in game) is in 'lobby' state", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.create(cast(a), "lobby-1");
	assertEquals(handler.getState(cast(a)), "lobby");
});

// ─── register ────────────────────────────────────────────────────────────────

Deno.test("register - sends lobbies list on registration", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "lobbies");
});

Deno.test("register - initial lobbies list is empty", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	assertEquals((last(a) as { type: string; lobbies: msg.LobbyView[] }).lobbies, []);
});

Deno.test("register - existing non-ingame lobbies appear in list", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.create(cast(a), "lobby-1");
	handler.register(cast(b), "bob");
	const m = last(b) as { type: string; lobbies: msg.LobbyView[] };
	assertEquals(m.type, "lobbies");
	assertEquals(m.lobbies.some((l) => l.id === "lobby-1"), true);
});

Deno.test("register - multiple registrations are independent", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	assertEquals(handler.getState(cast(a)), "lobby");
	assertEquals(handler.getState(cast(b)), "lobby");
});

// ─── error ───────────────────────────────────────────────────────────────────

Deno.test("error - sends ko with message in lobby state", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.error(cast(a), "something went wrong");
	const m = last(a) as { type: string; message: string };
	assertEquals(m.type, "ko");
	assertEquals(m.message, "something went wrong");
});

Deno.test("error - sends ko in register state (unregistered socket)", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.error(cast(a), "oops");
	const m = last(a) as { type: string; message: string };
	assertEquals(m.type, "ko");
	assertEquals(m.message, "oops");
});

Deno.test("error - in game state sends ko with board", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	handler.ready(cast(b));
	// both are now in game state
	handler.error(cast(a), "bad move");
	const m = last(a) as { type: string; message: string; board: unknown };
	assertEquals(m.type, "ko");
	assertEquals(m.message, "bad move");
	assertEquals(Array.isArray(m.board), true); // board is attached in game state
});

// ─── close ───────────────────────────────────────────────────────────────────

Deno.test("close - sends closing then closes the socket", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.close(cast(a));
	const m = last(a) as { type: string };
	assertEquals(m.type, "closing");
	assertEquals(a.closed, true);
});

Deno.test("close - works on unregistered socket", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.close(cast(a));
	assertEquals(a.closed, true);
});

// ─── edge cases: operations without prior register ────────────────────────────

Deno.test("create without register - triggers close", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.create(cast(a), "lobby-x");
	// close() sends "closing" and closes socket
	assertEquals(a.closed, true);
});

Deno.test("join without register - triggers close", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.join(cast(a), "lobby-x");
	assertEquals(a.closed, true);
});

Deno.test("leave without register - triggers close", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.leave(cast(a));
	assertEquals(a.closed, true);
});

Deno.test("ready without register - triggers close", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.ready(cast(a));
	assertEquals(a.closed, true);
});

Deno.test("action without register - triggers close", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.action(cast(a), {type: "action", card: "symbol", player: 1, x: 0, y: 0, opt1: 0, opt2: 0, opt3: "X"});
	assertEquals(a.closed, true);
});
