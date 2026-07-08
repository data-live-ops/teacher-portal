/**
 * Sequential (magnitude) heatmap color scale for the Attendance Portal grid.
 * One hue (blue), light -> dark, per the project's validated dataviz palette
 * (dataviz skill references/palette.md). Missing values get a neutral muted
 * gray, never a scale color, so "no data" is never mistaken for "low value".
 */

const SEQUENTIAL_STEPS = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
];

const DARK_TEXT_THRESHOLD_INDEX = 3; // steps >= this index get white text

const MISSING_BACKGROUND = '#f2f2f0';
const MISSING_TEXT = '#898781';

export function getHeatmapCellStyle(value, min, max) {
  if (value === null || value === undefined || min === null || max === null) {
    return { background: MISSING_BACKGROUND, color: MISSING_TEXT };
  }

  if (max === min) {
    const midIndex = Math.floor(SEQUENTIAL_STEPS.length / 2);
    return {
      background: SEQUENTIAL_STEPS[midIndex],
      color: midIndex >= DARK_TEXT_THRESHOLD_INDEX ? '#ffffff' : '#0b0b0b',
    };
  }

  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const index = Math.min(
    SEQUENTIAL_STEPS.length - 1,
    Math.floor(ratio * SEQUENTIAL_STEPS.length)
  );

  return {
    background: SEQUENTIAL_STEPS[index],
    color: index >= DARK_TEXT_THRESHOLD_INDEX ? '#ffffff' : '#0b0b0b',
  };
}

/** Min/max across every non-null value currently visible for a sheet, driving the scale. */
export function getValueRange(values) {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return { min: null, max: null };
  return { min: Math.min(...present), max: Math.max(...present) };
}
