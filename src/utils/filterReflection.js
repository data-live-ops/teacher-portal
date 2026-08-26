/**
 * Cross-joins the selected values of each active filter dimension into
 * readable "value - value - ..." labels, e.g. Grade [4] x Slot ["Matematika 1 (1x)"]
 * -> ["4 - Matematika 1 (1x)"]. Dimensions with no selection are skipped
 * entirely rather than forcing an empty slot into every combination.
 */
export function buildFilterReflections(...dimensions) {
  const active = dimensions.filter((d) => d.length > 0);
  if (active.length === 0) return [];
  return active
    .reduce((combos, dim) => (
      combos.length === 0
        ? dim.map((value) => [value])
        : combos.flatMap((combo) => dim.map((value) => [...combo, value]))
    ), [])
    .map((combo) => combo.join(' - '));
}
