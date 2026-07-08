export function toShuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Sattolo's algorithm: j is drawn below i (toShuffled draws i inclusive), so every
// run is a single cycle and no element keeps its slot -- a derangement. The trade is
// that only cyclic permutations occur, not every ordering. Length < 2 can't be
// deranged and returns unchanged.
export function toDeranged(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
