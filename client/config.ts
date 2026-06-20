// config.ts — constantes de configuration + helpers de chemins d'assets (APNG).

// DEBUG : true => le joueur reçoit TOUS les jokers (pour tester chaque pouvoir).
// Repasser à false pour le tirage normal par seed. (à retirer en prod)
export const DEBUG_ALL_JOKERS = true;
export const ALL_JOKERS = ["invert", "resize", "bomb", "nomad", "immunity", "trap", "virus"];

export const END_ANIM_MS = 6000; // durée des APNG VICTOIRE/DEFAITE (mesurée)

// Correspondance joker -> base du nom de fichier APNG (client/assets/<BASE>_{IDLE,SELECTED}.png).
export const JOKER_ART = {
	invert: "INVERT", resize: "SCALE", bomb: "BOMBOCLAAT", nomad: "NOMADE",
	immunity: "IMMUNITE", trap: "PIEGE", virus: "VIRUS",
	// ttt -> "BAGAR" (pas encore actif)
};
export function jokerAsset(base, selected) {
	return `/assets/${base}_${selected ? "SELECTED" : "IDLE"}.png`;
}
// Asset APNG d'un symbole posé (X / O).
export function symbolAsset(sym) {
	return `/assets/XOXO_${sym}.png`;
}

// Animations d'effet jouées une fois, centrées sur la case ciblée { base, ms (durée mesurée), size px }.
export const EFFECTS = {
	bomb: { base: "BOMBOCLAAT_ANIM", ms: 2240, size: 300 },
	virus: { base: "VIRUS_ANIM", ms: 1500, size: 180 },     // ms/size à ajuster sur le rendu réel
	immunity: { base: "IMMUNITE_ANIM", ms: 1500, size: 200 }, // ms/size à ajuster sur le rendu réel
};

// Transition jouée sur une case lors d'un Invert : APNG du symbole qui mute (O→X / X→O).
export const TRANSI = { o_to_x: "TRANSI_O_to_X", x_to_o: "TRANSI_X_to_O", ms: 1000 }; // ms à ajuster
