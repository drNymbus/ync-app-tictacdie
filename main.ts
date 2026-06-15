import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "npm:ws";
import * as msg from "./shared/protocol.ts";
import * as handler from "./handler.ts";

const page = (f: string) => readFileSync(join("client", f), "utf8");

const server = createServer((req, res) => {
	const url = new URL(req.url!, "http://x");

	if (url.pathname === "/") {
		res.end(page("index.html"));
	} else if (url.pathname === "/lobby.js") {
		res.setHeader("content-type", "text/javascript");
		res.end(page("lobby.js"));
	} else if (url.pathname === "/game.js") {
		res.setHeader("content-type", "text/javascript");
		res.end(page("game.js"));
	} else if (url.pathname === "/game.css") {
		res.setHeader("content-type", "text/css");
		res.end(page("game.css"));
	} else {
		res.statusCode = 404;
		res.end(page("error.html"));
	}
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
	ws.on("message", (raw: Event) => {
		const state = handler.getState(ws);
		if (state === "register") {
			const m = JSON.parse(raw.toString()) as msg.ClientLobbyMessage;
			if (m.type !== "signin") return;
			if (m.name === "") return;
			handler.register(ws, m.name);
		} else if (state === "lobby") {
			try {
				const m = JSON.parse(raw.toString()) as msg.ClientLobbyMessage;
				switch (m.type) {
					case "create":
						handler.create(ws, m.id);
						break;
					case "join":
						handler.join(ws, m.id);
						break;
					case "ready":
						handler.ready(ws);
						break;
					case "leave":
						handler.leave(ws);
						break;
				}
			} catch (e) {
				if (e instanceof Error) {
					console.error(e.message);
				} else { console.error(e); }
				handler.error(ws, "Internal error");
			}
		} else if (state === "game") {
			try {
				const m = JSON.parse(raw.toString()) as msg.ClientGameMessage;
				if (m.type !== "action") return;
				handler.action(ws, m);
			} catch (e) {
				if (e instanceof Error) {
					console.error(e.message);
				} else { console.error(e); }
				handler.error(ws, "Internal error");
			}
		}
	});

	ws.on("close", () => { handler.close(ws); });
});

server.listen(3000, () => console.log("http://localhost:3000"));
