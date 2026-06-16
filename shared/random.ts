function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

export function randInt(seed: number, min: number, max: number): number {
	const rng = seededRng(seed);
	return Math.floor(rng() * (max - min + 1)) + min;
}
