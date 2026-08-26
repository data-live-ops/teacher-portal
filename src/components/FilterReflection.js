import React from 'react';

/** Renders each active-filter combination as a chip, e.g. "4 - Matematika 1 (1x)". */
function FilterReflection({ labels }) {
  if (!labels || labels.length === 0) return null;

  return (
    <div className="filter-reflection">
      {labels.map((label) => (
        <span key={label} className="filter-reflection-chip">{label}</span>
      ))}
    </div>
  );
}

export default FilterReflection;
