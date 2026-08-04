import React, { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getCellValue, formatCellValue } from '../utils/attendanceGrid';
import { getHeatmapCellStyle, getValueRange } from '../utils/heatmapColor';
import '../styles/AttendancePortal.css';

const STICKY_COLUMNS = [
    { key: 'grade', label: 'Grade', width: 60 },
    { key: 'guruJuara', label: 'Guru Juara', width: 170 },
    { key: 'slotName', label: 'Slot', width: 170 },
    { key: 'days', label: 'Days', width: 140 },
    { key: 'timeRange', label: 'Times', width: 110 },
];

const NUMBER_COL_WIDTH = 44;
const WEEK_COL_WIDTH = 100;
const STICKY_TOTAL_WIDTH = NUMBER_COL_WIDTH + STICKY_COLUMNS.reduce((sum, col) => sum + col.width, 0);
const ROW_HEIGHT = 40;
const OVERSCAN = 8;

function AttendanceMetricGrid({ rows, weeks, statsIndexByDataset, sheetConfig }) {
    const scrollRef = useRef(null);

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: OVERSCAN,
    });

    const cellValues = useMemo(() => {
        const map = new Map();
        for (const row of rows) {
            for (const week of weeks) {
                map.set(
                    `${row.key}|${week.date}`,
                    getCellValue(sheetConfig, statsIndexByDataset, row.grade, row.slotName, week.date)
                );
            }
        }
        return map;
    }, [rows, weeks, statsIndexByDataset, sheetConfig]);

    const { min, max } = useMemo(
        () => getValueRange(Array.from(cellValues.values())),
        [cellValues]
    );

    if (rows.length === 0) {
        return <div className="attendance-grid-empty">Belum ada data untuk semester ini.</div>;
    }

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalHeight = rowVirtualizer.getTotalSize();
    const paddingTop = virtualRows[0]?.start ?? 0;
    const paddingBottom = virtualRows.length > 0
        ? totalHeight - virtualRows[virtualRows.length - 1].end
        : 0;
    const colCount = 1 + STICKY_COLUMNS.length + weeks.length;
    const tableWidth = STICKY_TOTAL_WIDTH + weeks.length * WEEK_COL_WIDTH;

    return (
        <div className="table-scroll-container" ref={scrollRef}>
            <table className="attendance-grid-table" style={{ width: tableWidth }}>
                <thead>
                    <tr>
                        <th className="row-number-col">No.</th>
                        {STICKY_COLUMNS.map((col, index) => (
                            <th key={col.key} className={`attendance-sticky-col attendance-sticky-col-${index + 1}`}>
                                {col.label}
                            </th>
                        ))}
                        {weeks.map((week) => (
                            <th key={week.date} className="attendance-week-col" title={week.date}>
                                <div className="attendance-week-header">
                                    <span className="attendance-week-index">{week.label}</span>
                                    <span className="attendance-week-date">{week.dateLabel}</span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {paddingTop > 0 && (
                        <tr aria-hidden="true">
                            <td colSpan={colCount} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                        </tr>
                    )}
                    {virtualRows.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        return (
                            <tr key={row.key}>
                                <td className="row-number-col">{virtualRow.index + 1}</td>
                                {STICKY_COLUMNS.map((col, index) => (
                                    <td key={col.key} className={`attendance-sticky-col attendance-sticky-col-${index + 1}`}>
                                        {row[col.key]}
                                    </td>
                                ))}
                                {weeks.map((week) => {
                                    const value = cellValues.get(`${row.key}|${week.date}`);
                                    const style = getHeatmapCellStyle(value, min, max);
                                    return (
                                        <td
                                            key={week.date}
                                            className="attendance-week-col"
                                            title={week.date}
                                            style={{ backgroundColor: style.background, color: style.color }}
                                        >
                                            {formatCellValue(sheetConfig, value)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    {paddingBottom > 0 && (
                        <tr aria-hidden="true">
                            <td colSpan={colCount} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default AttendanceMetricGrid;
