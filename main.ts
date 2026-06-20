import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "npm:ws";

import * as msg from "./shared/protocol.ts";
import * as handler from "./handler.ts";

const port = parseInt(Deno.env.get("PORT")) || 3000;

const page = (f: string) => readFileSync(join(Deno.cwd() + "/client", f), "utf8");

const server = createServer((req, res) => {
	const pathname = req.url!;
	if (pathname === "/" || pathname === "index.html") {
		res.end(page("index.html"));
	} else if (pathname === "/lobby.js") {
		res.setHeader("content-type", "text/javascript");
		res.end(page("lobby.js"));
	} else if (pathname === "/game.js") {
		res.setHeader("content-type", "text/javascript");
		res.end(page("game.js"));
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
					case "refresh":
						handler.sendLobbies(ws);
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

server.listen(port, () => console.log("Listening on port:", port));
