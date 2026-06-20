import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "npm:ws";

import * as msg from "./shared/protocol.ts";
import * as handler from "./handler.ts";

const port = Number(Deno.env.get("PORT")) || 3000;

// content-type par extension (tout est servi depuis client/ : html/js/css + assets).
const MIME: Record<string, string> = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".png": "image/png",
	".mp4": "video/mp4",
};

// Lecture binaire (Buffer, pas d'encodage) : indispensable pour les APNG/vidéos — un read
// "utf8" corromprait les octets. Le texte (html/js/css) est servi tel quel, le navigateur
// le décode via le content-type.
const page = (f: string) => readFileSync(join(Deno.cwd(), "client", f));

const server = createServer((req, res) => {
	// new URL : pathname normalisé (".." résolu, pas de path traversal) et SANS query string
	// (les assets sont demandés avec un cache-buster "?t=..." qu'il faut retirer du chemin de fichier).
	const url = new URL(req.url!, "http://x");
	const path = url.pathname === "/" ? "index.html" : url.pathname;
	const ext = path.slice(path.lastIndexOf("."));

	try {
		if (ext === ".ts") throw Error(); // on ne sert jamais les sources TS au navigateur
		res.setHeader("content-type", MIME[ext] ?? "application/octet-stream");
		res.end(page(path));
	} catch {
		// fichier inexistant -> page d'erreur.
		res.statusCode = 404;
		res.setHeader("content-type", "text/html");
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
					case "refresh":
						handler.sendLobbies(ws);
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

server.listen(port, () => console.log("Listening on port:", port));
