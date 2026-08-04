// A lightweight fuzzy matcher for the command palette — no library, just two
// tiers. The common case (typing a contiguous fragment of a title) is a
// plain substring match, ranked purely by how early it starts, so it
// behaves exactly like the existing search field. A query that isn't a
// substring anywhere falls back to subsequence matching (its characters
// appearing in order, not necessarily contiguously — e.g. "fnrpt" still
// finds "Finish report") so typo-tolerant/abbreviated queries still work,
// but a subsequence match always ranks behind every substring match via a
// large flat offset, since a real substring is always the more relevant
// interpretation of what was typed.
const SUBSEQUENCE_OFFSET = 100_000;

// Lower is a better match; null means no match at all.
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  const substringIndex = t.indexOf(q);
  if (substringIndex !== -1) return substringIndex;

  let qi = 0;
  let score = 0;
  let firstMatchIndex = -1;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (firstMatchIndex === -1) firstMatchIndex = ti;
      consecutive += 1;
      score -= consecutive;
      qi += 1;
    } else {
      consecutive = 0;
    }
  }
  if (qi < q.length) return null;
  return SUBSEQUENCE_OFFSET + score + firstMatchIndex;
}
