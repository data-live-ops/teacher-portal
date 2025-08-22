import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, X, Check, Edit3, Trash2, Users, User, ChevronDown, ChevronUp, Filter, Search } from 'lucide-react';

const SortableFilterableHeader = ({
    column,
    title,
    sortConfig,
    onSort,
    filterValue,
    onFilter,
    existingValues = [],
    columnType = 'text',
    width,
    onResize
}) => {
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [tempFilterValue, setTempFilterValue] = useState(filterValue || '');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowFilterDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getSortIcon = () => {
        if (sortConfig?.key !== column) return <ChevronDown size={14} className="sort-icon inactive" />;
        return sortConfig.direction === 'asc' ?
            <ChevronUp size={14} className="sort-icon active" /> :
            <ChevronDown size={14} className="sort-icon active" />;
    };

    const applyFilter = () => {
        onFilter(column, tempFilterValue);
        setShowFilterDropdown(false);
    };

    const clearFilter = () => {
        setTempFilterValue('');
        onFilter(column, '');
        setShowFilterDropdown(false);
    };

    const renderFilterInput = () => {
        switch (columnType) {
            case 'select':
                return (
                    <select
                        value={tempFilterValue}
                        onChange={(e) => setTempFilterValue(e.target.value)}
                        className="filter-select"
                    >
                        <option value="">All</option>
                        {existingValues.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={tempFilterValue}
                        onChange={(e) => setTempFilterValue(e.target.value)}
                        placeholder="Filter by number..."
                        className="filter-input"
                    />
                );
            case 'date':
                return (
                    <input
                        type="date"
                        value={tempFilterValue}
                        onChange={(e) => setTempFilterValue(e.target.value)}
                        className="filter-input"
                    />
                );
            default:
                return (
                    <input
                        type="text"
                        value={tempFilterValue}
                        onChange={(e) => setTempFilterValue(e.target.value)}
                        placeholder="Filter..."
                        className="filter-input"
                    />
                );
        }
    };

    return (
        <th className="sortable-header" style={{ width: `${width}px`, position: 'relative' }}>
            <div className="header-content-on-sort-table">
                <span
                    className="header-title"
                    onClick={() => onSort(column)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    {title}
                    {getSortIcon()}
                </span>

                <button
                    className={`filter-button ${filterValue ? 'active' : ''}`}
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    title="Filter"
                >
                    <Filter size={12} />
                </button>
            </div>

            {showFilterDropdown && (
                <div className="filter-dropdown-sort-table" ref={dropdownRef}>
                    <div className="filter-content">
                        {renderFilterInput()}
                        <div className="filter-actions">
                            <button onClick={applyFilter} className="apply-button">Apply</button>
                            <button onClick={clearFilter} className="clear-button">Clear</button>
                        </div>
                    </div>
                </div>
            )}

            {onResize && (
                <div
                    className="resize-handle"
                    onMouseDown={(e) => onResize(column, e)}
                />
            )}

            <style jsx>{`
        .sortable-header {
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          padding: 8px 12px;
          position: relative;
          user-select: none;
        }

        .header-content-on-sort-table {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .header-title {
          font-weight: 600;
          color: #374151;
          flex: 1;
        }

        .sort-icon {
          transition: all 0.2s;
        }

        .sort-icon.inactive {
          color: #9ca3af;
        }

        .sort-icon.active {
          color: #3b82f6;
        }

        .filter-button {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 4px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .filter-button:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .filter-button.active {
          background: #dbeafe;
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .filter-dropdown-sort-table {
          position: absolute;
          top: 100%;
          right: 0;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          min-width: 200px;
        }

        .filter-content {
          padding: 12px;
        }

        .filter-input, .filter-select {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .filter-input:focus, .filter-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .filter-actions {
          display: flex;
          gap: 6px;
        }

        .apply-button, .clear-button {
          padding: 4px 8px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .apply-button {
          background: #3b82f6;
          color: white;
        }

        .apply-button:hover {
          background: #2563eb;
        }

        .clear-button {
          background: #f3f4f6;
          color: #374151;
        }

        .clear-button:hover {
          background: #e5e7eb;
        }

        .resize-handle {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          cursor: col-resize;
          background: transparent;
          transition: background-color 0.2s;
        }

        .resize-handle:hover {
          background: #3b82f6;
        }
      `}</style>
        </th>
    );
};

export default SortableFilterableHeader;