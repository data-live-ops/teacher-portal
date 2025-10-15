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
  const [selectedValues, setSelectedValues] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (columnType === 'select' && filterValue) {
      try {
        const parsed = JSON.parse(filterValue);
        setSelectedValues(Array.isArray(parsed) ? parsed : [filterValue]);
      } catch {
        setSelectedValues([filterValue]);
      }
    } else if (columnType === 'select') {
      setSelectedValues([]);
    } else {
      setTempFilterValue(filterValue || '');
    }
  }, [filterValue, columnType]);

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
    if (columnType === 'select' && selectedValues.length > 0) {
      onFilter(column, JSON.stringify(selectedValues));
    } else if (columnType === 'select') {
      onFilter(column, '');
    } else {
      onFilter(column, tempFilterValue);
    }
    setShowFilterDropdown(false);
  };

  const clearFilter = () => {
    setTempFilterValue('');
    setSelectedValues([]);
    onFilter(column, '');
    setShowFilterDropdown(false);
  };

  const toggleValueSelection = (value) => {
    setSelectedValues(prev => {
      const newValues = prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value];

      setTimeout(() => {
        if (newValues.length > 0) {
          onFilter(column, JSON.stringify(newValues));
        } else {
          onFilter(column, '');
        }
      }, 0);

      return newValues;
    });
  };

  const selectAll = () => {
    const allValues = [...existingValues];
    setSelectedValues(allValues);

    setTimeout(() => {
      onFilter(column, JSON.stringify(allValues));
    }, 0);
  };

  const deselectAll = () => {
    setSelectedValues([]);

    // Auto-apply filter
    setTimeout(() => {
      onFilter(column, '');
    }, 0);
  };

  const renderFilterInput = () => {
    switch (columnType) {
      case 'select':
        return (
          <div className="checkbox-filter-container">
            <div className="filter-select-all">
              <button onClick={selectAll} className="select-all-btn">Select All</button>
              <button onClick={deselectAll} className="select-all-btn">Deselect All</button>
            </div>
            <div className="checkbox-list">
              {existingValues.map(option => (
                <label key={option} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={() => toggleValueSelection(option)}
                  />
                  <span className="checkbox-label">{option}</span>
                </label>
              ))}
            </div>
          </div>
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
          {columnType === 'select' && selectedValues.length > 0 && (
            <span className="filter-count">{selectedValues.length}</span>
          )}
        </button>
      </div>

      {showFilterDropdown && (
        <div className="filter-dropdown-sort-table" ref={dropdownRef}>
          <div className="filter-content">
            {renderFilterInput()}
            <div className="filter-actions">
              {columnType !== 'select' && (
                <button onClick={applyFilter} className="apply-button">Apply</button>
              )}
              <button onClick={clearFilter} className="clear-button">
                {columnType === 'select' ? 'Clear & Close' : 'Clear'}
              </button>
              {columnType === 'select' && (
                <button onClick={() => setShowFilterDropdown(false)} className="close-button">
                  Close
                </button>
              )}
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
          position: relative;
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

        .filter-count {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #3b82f6;
          color: white;
          font-size: 9px;
          font-weight: 600;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
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
          max-width: 300px;
        }

        .filter-content {
          padding: 12px;
        }

        .checkbox-filter-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .filter-select-all {
          display: flex;
          gap: 6px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }

        .select-all-btn {
          flex: 1;
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          color: #374151;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .select-all-btn:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
          color: #1f2937;
        }

        .checkbox-list {
          max-height: 250px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .checkbox-item:hover {
          background: #f9fafb;
        }

        .checkbox-item input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .checkbox-label {
          flex: 1;
          font-size: 13px;
          color: #374151;
          user-select: none;
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

        .apply-button, .clear-button, .close-button {
          padding: 4px 8px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .apply-button {
          background: #3b82f6;
          color: white;
        }

        .apply-button:hover {
          background: #2563eb;
        }

        .clear-button {
          background: #fee2e2;
          color: #dc2626;
        }

        .clear-button:hover {
          background: #fecaca;
        }

        .close-button {
          background: #3b82f6;
          color: white;
        }

        .close-button:hover {
          background: #2563eb;
        }

        .resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 8px;
          cursor: col-resize;
          background: transparent;
          transition: all 0.2s;
          z-index: 15;
        }

        .resize-handle::before {
          content: '';
          position: absolute;
          right: 3px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #cbd5e1;
          transition: background-color 0.2s;
        }

        .resize-handle:hover::before {
          background: #3b82f6;
          width: 3px;
          right: 2.5px;
        }

        .resize-handle:active::before {
          background: #2563eb;
          width: 4px;
          right: 2px;
        }
      `}</style>
    </th>
  );
};

export default SortableFilterableHeader;