import { assertEquals } from "@std/assert";
import { WebSocket } from "npm:ws";
import * as handler from "./handler.ts";
import * as msg from "./shared/protocol.ts";

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
		send(data: unknown) { ws.received.push(data); },
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

// ─── create ──────────────────────────────────────────────────────────────────

Deno.test("create - sends ok after creation", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.create(cast(a), "lobby-1");
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "ok");
});

// ─── join ─────────────────────────────────────────────────────────────────────

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

Deno.test("join - player cannot join if already in a lobby", () => {
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

// ─── ready ────────────────────────────────────────────────────────────────────

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

Deno.test("ready - toggling ready twice prevents game from starting", () => {
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

Deno.test("ready - both players ready broadcasts start to both", () => {
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

Deno.test("ready - both players in game state after start", () => {
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

Deno.test("ready - ingame lobby not visible in lobby list", () => {
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

// ─── leave ────────────────────────────────────────────────────────────────────

Deno.test("leave - sends ok", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.leave(cast(b));
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ok");
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

Deno.test("leave - lobby becomes joinable again after player leaves", () => {
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

// ─── error ───────────────────────────────────────────────────────────────────

Deno.test("error - sends ko with message", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.error(cast(a), "something went wrong");
	const m = last(a) as { type: string; message: string };
	assertEquals(m.type, "ko");
	assertEquals(m.message, "something went wrong");
});

// ─── close ───────────────────────────────────────────────────────────────────

Deno.test("close - socket is closed", () => {
	handler._resetForTest();
	const a = mockWs();
	handler.register(cast(a), "alice");
	handler.close(cast(a));
	assertEquals(a.closed, true);
});

// ─── PLAYERS map ─────────────────────────────────────────────────────────────

Deno.test("players map - creator lobby field is set after create", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	// if player.lobby was not set, ready would send ko instead of ok
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

Deno.test("players map - player lobby field cleared after leave", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1");
	handler.leave(cast(b));
	handler.ready(cast(b));
	// player.lobby is "" after leave, so ready should send ko
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ko");
});

Deno.test("players map - player ready flag cleared after leave", () => {
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
	// b rejoins — if ready flag wasn't cleared, b would count as ready immediately
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	// only a is ready, game should not start
	assertEquals(handler.getState(cast(a)), "lobby");
	assertEquals(handler.getState(cast(b)), "lobby");
});

Deno.test("players map - game id set for both players after game starts", () => {
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

Deno.test("players map - two players have independent entries", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.create(cast(a), "lobby-1");
	// a is in lobby-1, b is registered but lobby is ""
	handler.ready(cast(b)); // should ko — b has no lobby
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ko");
	// a is unaffected
	handler.join(cast(b), "lobby-1");
	handler.ready(cast(a));
	assertEquals((last(a) as msg.ServerLobbyMessage).type, "ok");
});

// ─── LOBBIES map ─────────────────────────────────────────────────────────────

Deno.test("lobbies map - lobby has exactly 1 player after create", () => {
	handler._resetForTest();
	const a = mockWs();
	const b = mockWs();
	const c = mockWs();
	handler.register(cast(a), "alice");
	handler.register(cast(b), "bob");
	handler.register(cast(c), "charlie");
	handler.create(cast(a), "lobby-1");
	handler.join(cast(b), "lobby-1"); // should succeed
	handler.join(cast(c), "lobby-1"); // should fail — lobby now full
	assertEquals((last(b) as msg.ServerLobbyMessage).type, "ok");
	assertEquals((last(c) as msg.ServerLobbyMessage).type, "ko");
});

Deno.test("lobbies map - lobby still exists after one of two players leaves", () => {
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
	// lobby should still exist with just a in it
	handler.join(cast(c), "lobby-1");
	assertEquals((last(c) as msg.ServerLobbyMessage).type, "ok");
});

Deno.test("lobbies map - ingame flag set after both players ready", () => {
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
	// lobby-2 should be unaffected
	assertEquals(handler.getState(cast(c)), "lobby");
	assertEquals(handler.getState(cast(d)), "lobby");
});

Deno.test("lobbies map - starting game in lobby-1 does not hide lobby-2 from list", () => {
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

// ─── GAMES map ───────────────────────────────────────────────────────────────

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
	// both in game state proves a game entry was created and linked to both players
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

Deno.test("games map - unrelated players are not put in game state", () => {
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
	// c registered but never joined any lobby — should be unaffected
	assertEquals(handler.getState(cast(c)), "lobby");
});
