// dom.ts — petit helper de création d'élément DOM.
export function el(tag, props = {}) {
	const e = document.createElement(tag);
	Object.assign(e, props);
	return e;
}
