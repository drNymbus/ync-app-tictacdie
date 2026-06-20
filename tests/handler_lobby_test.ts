// handler_lobby_test.ts – create, join, leave, and lobby-map invariants.

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

// ─── create ──────────────────────────────────────────────────────────────────

Deno.test("create - sends ok after creation", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.create(cast(a), "lobby-1");
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "ok");
});

Deno.test("create - lobby appears in broadcast after creation", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	// b is not in a lobby so they receive the broadcastLobbies update
	const m = last(b) as { type: string; lobbies: msg.LobbyView[] };
	assertEquals(m.type, "lobbies");
	assertEquals(m.lobbies.some((l) => l.id === "lobby-1"), true);
});

Deno.test("create - creator state moves to lobby after create", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.create(cast(a), "lobby-1");
	assertEquals(handler.getState(cast(a)), "lobby");
});

// ─── join ────────────────────────────────────────────────────────────────────

Deno.test("join - valid join sends ok", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ok");
});

Deno.test("join - non-existent lobby sends ko", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.join(cast(a), "ghost");
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "ko");
});

Deno.test("join - full lobby sends ko to third player", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.join(cast(c), "lobby-1");
	assertEquals((last(c) as msg.ServerLobbyMessage).type, "ko");
});

Deno.test("join - ingame lobby sends ko", () => {
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

Deno.test("join - player already in a lobby receives ko", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.create(cast(b), "lobby-2");
	handler.join(cast(b), "lobby-1");
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ko");
});

// ─── leave ───────────────────────────────────────────────────────────────────

Deno.test("leave - sends lobbies broadcast to remaining free players", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.leave(cast(b));
	// b is now free again and receives the broadcast
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "lobbies");
});

Deno.test("leave - player can rejoin another lobby after leaving", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.create(cast(c), "lobby-2");
	handler.join(cast(b), "lobby-1");
	handler.leave(cast(b));
	handler.join(cast(b), "lobby-2");
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ok");
});

Deno.test("leave - lobby becomes joinable again after a player leaves", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.leave(cast(b));
	handler.join(cast(c), "lobby-1");
	assertEquals((last(c) as msg.ServerLobbyMessage).type, "ok");
});

// ─── PLAYERS map invariants ───────────────────────────────────────────────────

Deno.test("players map - creator lobby field is set after create", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	// lobby field must be set otherwise ready() would send ko
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "ok");
});

Deno.test("players map - joiner lobby field is set after join", () => {
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

Deno.test("players map - lobby field cleared after leave", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.leave(cast(b));
	handler.ready(cast(b)); // lobby="" so ready sends ko
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ko");
});

Deno.test("players map - ready flag cleared after leave", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(b));
	handler.leave(cast(b));
	// b rejoins: if ready flag weren't cleared it would count as ready immediately
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	// only a is ready; game must not start
	assertEquals(handler.getState(cast(a)), "lobby");
	assertEquals(handler.getState(cast(b)), "lobby");
});

Deno.test("players map - two players have independent state entries", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.ready(cast(b)); // b has no lobby → ko
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ko");
	// a is unaffected
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "ok");
});

// ─── LOBBIES map invariants ───────────────────────────────────────────────────

Deno.test("lobbies map - only 2 players fit in a lobby", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1"); // succeeds
	handler.join(cast(c), "lobby-1"); // fails — full
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ok");
	assertEquals((last(c) as msg.ServerLobbyMessage).type, "ko");
});

Deno.test("lobbies map - lobby survives one player leaving", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.leave(cast(b));
	handler.join(cast(c), "lobby-1");
	assertEquals((last(c) as msg.ServerLobbyMessage).type, "ok");
});

Deno.test("lobbies map - two lobbies coexist independently", () => {
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
	handler.ready(cast(b)); // lobby-1 game starts
	// lobby-2 must be unaffected
	assertEquals(handler.getState(cast(c)), "lobby");
	assertEquals(handler.getState(cast(d)), "lobby");
});

Deno.test("lobbies map - player names appear correctly in lobby list", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.register(cast(c), "charlie");
	const m = last(c) as { type: string; lobbies: msg.LobbyView[] };
	const lobby = m.lobbies.find((l) => l.id === "lobby-1");
	assertEquals(lobby?.players.includes("alice"), true);
	assertEquals(lobby?.players.includes("bob"), true);
});
