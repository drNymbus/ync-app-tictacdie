// anim.ts — animations d'effet (APNG) jouées sur le board : bombe, virus, immunité, invert.
import { S } from "./state.ts";
import { el } from "./dom.ts";
import { EFFECTS, TRANSI, symbolAsset } from "./config.ts";
import { renderAll } from "./render.ts";

// Cases dont le symbole est masqué pendant une transition Invert ("x,y").
export const transitioning = new Set();

// Joue l'animation d'effet d'une carte, centrée sur le centre de la case (x, y), puis la retire.
export function playEffect(card, x, y) {
	const fx = EFFECTS[card];
	if (!fx) return;
	// rAF : attend que le board soit (re)rendu pour lire la position réelle de la case.
	requestAnimationFrame(() => {
		if (!S.root) return;
		const cell = S.root.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
		if (!cell) return;
		const r = cell.getBoundingClientRect();
		const img = el("img", { className: "effect", src: `/assets/${fx.base}.png?t=${Date.now()}`, alt: "" });
		img.style.left = (r.left + r.width / 2) + "px"; // centre de l'anim = centre de la case
		img.style.top = (r.top + r.height / 2) + "px";
		img.style.width = fx.size + "px";
		S.root.appendChild(img);
		setTimeout(() => img.remove(), fx.ms); // retiré après une lecture (l'APNG boucle sinon)
	});
}

// Fait disparaître en fondu les symboles détruits par la bombe, calé sur la durée de l'anim.
// cells = [{ x, y, sym }] mémorisés avant le vidage du board (cf. applyLocalTEMP "bomb").
export function fadeOutSymbols(cells) {
	if (!cells || !cells.length) return;
	// rAF : attend le re-rendu du board (cases désormais vides) pour lire leur position réelle.
	requestAnimationFrame(() => {
		if (!S.root) return;
		for (const { x, y, sym } of cells) {
			const cell = S.root.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
			if (!cell) continue;
			const r = cell.getBoundingClientRect();
			const img = el("img", { className: "sym-fade", src: symbolAsset(sym), alt: "" });
			img.style.left = (r.left + r.width / 2) + "px"; // centre du symbole = centre de la case
			img.style.top = (r.top + r.height / 2) + "px";
			img.style.width = r.width + "px";
			img.style.height = r.height + "px";
			S.root.appendChild(img);
			setTimeout(() => img.remove(), EFFECTS.bomb.ms);
		}
	});
}

// Virus qui mute : joue l'anim virus sur la case, puis bascule le symbole affiché à mi-anim.
// cell.content porte déjà la nouvelle valeur (logique) ; on diffère seulement le rendu.
export function morphVirus(cell, x, y) {
	playEffect("virus", x, y);
	setTimeout(() => {
		cell.displayContent = cell.content;
		if (S.root) renderAll();
	}, EFFECTS.virus.ms / 2);
}

// Immunité : joue l'APNG sur la case et le GARDE figé sur sa dernière frame (num_plays patché à 1)
// jusqu'à l'expiration du joker (2 tours). L'image est rattachée à la cellule pour être retirée
// par localTick au moment où l'immunité retombe. (overlay flottant → survit aux re-rendus du board)
export function playImmunity(cell, x, y) {
	const fx = EFFECTS.immunity;
	requestAnimationFrame(() => {
		if (!S.root) return;
		const el2 = S.root.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
		if (!el2) return;
		const r = el2.getBoundingClientRect();
		const img = el("img", { className: "effect", src: `/assets/${fx.base}.png?t=${Date.now()}`, alt: "" });
		img.style.left = (r.left + r.width / 2) + "px";
		img.style.top = (r.top + r.height / 2) + "px";
		img.style.width = fx.size + "px";
		S.root.appendChild(img);
		cell._fx = img; // retiré à l'expiration (cf. localTick, branche immunity)
	});
}

// Sortie de l'APNG immunité : léger grossissement au centre puis contraction jusqu'à disparition.
export function dismissImmunity(img) {
	img.classList.add("immunity-out");
	img.addEventListener("animationend", () => img.remove(), { once: true });
}

// Invert : pose l'APNG de transition sur chaque case inversée (O→X / X→O), masque le symbole
// réel dessous le temps de l'anim, puis le révèle (déjà flippé dans le board) à la fin.
// cells = [{ x, y, from }] capturés AVANT le flip (cf. applyLocalTEMP "invert").
export function playInvertTransitions(cells) {
	if (!cells || !cells.length) return;
	for (const { x, y } of cells) transitioning.add(`${x},${y}`); // masque dès le prochain rendu
	// rAF : attend le re-rendu du board pour lire la position réelle des cases.
	requestAnimationFrame(() => {
		if (!S.root) return;
		for (const { x, y, from } of cells) {
			const cell = S.root.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
			if (!cell) { transitioning.delete(`${x},${y}`); continue; }
			const r = cell.getBoundingClientRect();
			const base = from === "O" ? TRANSI.o_to_x : TRANSI.x_to_o; // O→X joue o_to_x, X→O joue x_to_o
			const img = el("img", { className: "sym-transi", src: `/assets/${base}.png?t=${Date.now()}`, alt: "" });
			img.style.left = (r.left + r.width / 2) + "px";
			img.style.top = (r.top + r.height / 2) + "px";
			img.style.width = r.width + "px";
			img.style.height = r.height + "px";
			S.root.appendChild(img);
			setTimeout(() => {
				img.remove();
				transitioning.delete(`${x},${y}`);
				if (S.root) renderAll(); // révèle le symbole flippé une fois l'anim terminée
			}, TRANSI.ms);
		}
	});
}
