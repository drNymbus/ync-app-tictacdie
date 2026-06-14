import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer } from "npm:ws";
import * as msg from "./shared/protocol.ts";
import * as handler from "./handler.ts";

const page = (f: string) => readFileSync(join("client", f), "utf8");

const server = createServer((req, res) => {
	const url = new URL(req.url!, "http://x");

	if (url.pathname === "/") {
		res.end(page("index.html"));
	} else if (url.pathname === "/game") {
		res.end(page("game.html"));
	} else if (url.pathname === "/lobby.js") {
		res.setHeader("content-type", "text/javascript");
		res.end(page("lobby.js"));
	} else if (url.pathname === "/game.js") {
		res.setHeader("content-type", "text/javascript");
		res.end(page("game.js"));
	} else {
		res.statusCode = 404;
		res.end(page("error.html"));
	}
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
	ws.on("message", (raw) => {
		const state = handler.getState(ws);
		if (state === "lobby") {
			const m = JSON.parse(raw.toString()) as ClientLobbyMessage;
			switch (m.type) {
				case "signin":
					if (m.name === "") return;
					handler.register(ws, m.name);
					break;
				case "create":
					handler.create(ws);
					break;
				case "join":
					handler.join(ws, m.id);
					break;
				case "ready":
					const start = handler.ready(ws);
					if (start) state = "game";
					break;
				case "leave":
					lobby.leave(ws);
					break;
			}
		} else if (state === "game") {
			const m = JSON.parse(raw.toString()) as ClientGameMessage;
			if (m.type !== "action") return;
			handler.gameAction(ws, m);
		}
	});

	ws.on("close", () => { handler.close(ws); });
});

server.listen(3000, () => console.log("http://localhost:3000"));
