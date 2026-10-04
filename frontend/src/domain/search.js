const normalize = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase('en').trim().replace(/\s+/g, ' ');

export function searchPois(pois, query, limit = 8) {
  const term = normalize(query);
  if (!term) return [];
  const rank = (name) => {
    const text = normalize(name);
    if (text === term) return 0;
    if (text.startsWith(term)) return 1;
    if (text.split(' ').some((word) => word.startsWith(term))) return 2;
    return text.includes(term) ? 3 : Infinity;
  };
  return pois.map((poi) => ({ poi, score: Math.min(...[poi.name, ...(poi.aliases || [])].map(rank)) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score || normalize(a.poi.name).localeCompare(normalize(b.poi.name), 'en') || String(a.poi.id).localeCompare(String(b.poi.id), 'en'))
    .slice(0, limit).map(({ poi }) => poi);
}
