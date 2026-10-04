const R = 6371000;
const radians = (n) => n * Math.PI / 180;

export function haversine(a, b) {
  const dlat = radians(b.lat - a.lat), dlng = radians(b.lng - a.lng);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Local equirectangular projection is sufficient for this campus-scale polyline.
export function distanceToRoute(position, coordinates) {
  if (!coordinates?.length) return Infinity;
  const scale = Math.cos(radians(position.lat));
  const xy = ([lng, lat]) => [radians(lng - position.lng) * R * scale, radians(lat - position.lat) * R];
  if (coordinates.length === 1) return Math.hypot(...xy(coordinates[0]));
  let nearest = Infinity;
  for (let i = 1; i < coordinates.length; i++) {
    const a = xy(coordinates[i - 1]), b = xy(coordinates[i]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / length)) : 0;
    nearest = Math.min(nearest, Math.hypot(a[0] + t * dx, a[1] + t * dy));
  }
  return nearest;
}

export function nextInstruction(instructions, index, position, threshold = 15) {
  if (!instructions.length) return 0;
  let next = Math.min(index, instructions.length - 1);
  // GraphHopper points mark the start of each instruction's segment. Keep the
  // first instruction at the origin; advance only upon reaching the next start.
  while (next < instructions.length - 1 && haversine(position, instructions[next + 1].point) <= threshold) next++;
  return next;
}

export function deviationState(position, geometry, previousCount) {
  const distance = distanceToRoute(position, geometry);
  // Poor fixes do not count toward deviation; no automatic route request is made.
  const count = position.accuracy > 50 ? 0 : distance > Math.max(35, position.accuracy || 0) ? previousCount + 1 : 0;
  return { count, distance, offRoute: count >= 3 };
}
