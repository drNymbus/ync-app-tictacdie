import { createServer } from "http";
import { readFileSync } from "fs";
import { join } from "path";
import { WebSocketServer } from "ws";
import type { ClientMsg } from "./shared/protocol";
import * as lobby from "./lobby";

const page = (f: string) => readFileSync(join("client", f), "utf8");

const server = createServer((req, res) => {
	const url = new URL(req.url!, "http://x");

	if (url.pathname === "/") {
		res.end(page("index.html"));
	} else if (url.pathname === "/game") {
		res.end(page("game.html");
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
		const m = JSON.parse(raw.toString()) as ClientMsg;
	});

	ws.on("close", () => {
	});
});

server.listen(3000, () => console.log("http://localhost:3000"));
