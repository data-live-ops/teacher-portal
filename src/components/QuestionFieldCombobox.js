import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Creatable single-select combobox: pick an existing option, or type a new
 * value and click "+ Tambah" to persist it (via onCreateOption) and select it.
 * Used for Subject/Grade fields in MandatoryQuestionManager so new curriculum
 * values entered once become pickable options for every question after.
 *
 * The dropdown is rendered via a portal into document.body and positioned
 * with fixed coordinates from the trigger's bounding rect - it lives inside a
 * scrollable table cell, and an in-place absolutely-positioned dropdown would
 * get clipped/require scrolling inside that small container to reach it. */
const QuestionFieldCombobox = ({ value, options, onChange, onCreateOption, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [position, setPosition] = useState(null);
    const wrapperRef = useRef(null);
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);

    const openDropdown = () => {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        setIsOpen(true);
    };

    const closeDropdown = () => {
        setIsOpen(false);
        setQuery('');
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            const clickedTrigger = wrapperRef.current && wrapperRef.current.contains(event.target);
            const clickedDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
            if (!clickedTrigger && !clickedDropdown) closeDropdown();
        };
        // Close on scroll of any ancestor (capture phase catches scroll on the
        // table's inner scroll container too, not just window) so the dropdown
        // never ends up floating away from its trigger.
        const handleScroll = (event) => {
            if (dropdownRef.current && dropdownRef.current.contains(event.target)) return;
            closeDropdown();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', closeDropdown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', closeDropdown);
        };
    }, [isOpen]);

    const filtered = query.trim()
        ? options.filter(opt => opt.toLowerCase().includes(query.trim().toLowerCase()))
        : options;

    const exactMatch = options.some(opt => opt.toLowerCase() === query.trim().toLowerCase());

    const handleSelect = (opt) => {
        onChange(opt);
        closeDropdown();
    };

    const handleCreate = async () => {
        const newValue = query.trim();
        if (!newValue) return;
        await onCreateOption(newValue);
        onChange(newValue);
        closeDropdown();
    };

    return (
        <div className="ica-combobox" ref={wrapperRef}>
            <button
                ref={triggerRef}
                type="button"
                className="ica-combobox-trigger"
                onClick={() => (isOpen ? closeDropdown() : openDropdown())}
            >
                <span className={value ? 'ica-combobox-value' : 'ica-combobox-placeholder'}>
                    {value || placeholder || 'Pilih...'}
                </span>
                <span className={`ica-combobox-caret ${isOpen ? 'open' : ''}`}>▾</span>
            </button>

            {isOpen && position && createPortal(
                <div
                    ref={dropdownRef}
                    className="ica-combobox-dropdown"
                    style={{ top: position.top, left: position.left, minWidth: position.width }}
                >
                    <input
                        type="text"
                        className="ica-combobox-search"
                        placeholder="Cari atau tambah baru..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    <div className="ica-combobox-list">
                        {filtered.length > 0 ? (
                            filtered.map(opt => (
                                <div
                                    key={opt}
                                    className={`ica-combobox-item ${opt === value ? 'selected' : ''}`}
                                    onClick={() => handleSelect(opt)}
                                >
                                    {opt}
                                </div>
                            ))
                        ) : (
                            <div className="ica-combobox-empty">
                                {options.length === 0 ? 'Belum ada opsi' : 'Tidak ada hasil'}
                            </div>
                        )}
                    </div>
                    {query.trim() && !exactMatch && (
                        <button type="button" className="ica-combobox-create" onClick={handleCreate}>
                            + Tambah "{query.trim()}"
                        </button>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default QuestionFieldCombobox;
