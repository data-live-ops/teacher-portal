import React, { useState, useEffect, useRef, useMemo } from 'react';

/** Checkbox dropdown filter (search + select-all + multi-pick), matching the
 * "Select Teachers" pattern from IndividualSchedule.js. options: [{value, label}]. */
function MultiSelectFilter({ label, options, selectedValues, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return options;
        const query = searchQuery.toLowerCase().trim();
        return options.filter((opt) => opt.label.toLowerCase().includes(query));
    }, [options, searchQuery]);

    const toggleValue = (value) => {
        onChange(
            selectedValues.includes(value)
                ? selectedValues.filter((v) => v !== value)
                : [...selectedValues, value]
        );
    };

    const handleSelectAll = () => {
        onChange(selectedValues.length === options.length ? [] : options.map((opt) => opt.value));
    };

    const buttonLabel = selectedValues.length === 0 || selectedValues.length === options.length
        ? `Semua ${label}`
        : `${selectedValues.length} ${label} Dipilih`;

    return (
        <div className="attendance-multiselect" ref={wrapperRef}>
            <button
                type="button"
                className="attendance-multiselect-button"
                onClick={() => setIsOpen((v) => !v)}
            >
                <span>{buttonLabel}</span>
                <span className={`attendance-multiselect-caret ${isOpen ? 'open' : ''}`}>▾</span>
            </button>

            {isOpen && (
                <div className="attendance-multiselect-dropdown">
                    <div className="attendance-multiselect-header">
                        <div className="attendance-multiselect-search">
                            <input
                                type="text"
                                placeholder={`Cari ${label.toLowerCase()}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="attendance-multiselect-clear-search"
                                    onClick={() => setSearchQuery('')}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <button type="button" className="attendance-multiselect-select-all" onClick={handleSelectAll}>
                            {selectedValues.length === options.length ? 'Hapus Semua' : 'Pilih Semua'}
                        </button>
                    </div>
                    <div className="attendance-multiselect-list">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <label key={opt.value} className="attendance-multiselect-item">
                                    <input
                                        type="checkbox"
                                        checked={selectedValues.includes(opt.value)}
                                        onChange={() => toggleValue(opt.value)}
                                    />
                                    <span className="attendance-multiselect-checkmark" />
                                    <span className="attendance-multiselect-item-label">{opt.label}</span>
                                </label>
                            ))
                        ) : (
                            <div className="attendance-multiselect-empty">Tidak ada hasil untuk "{searchQuery}"</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MultiSelectFilter;
