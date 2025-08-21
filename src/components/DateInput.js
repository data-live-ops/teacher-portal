import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/DateInput.css';

const DateInput = ({ value, onChange, placeholder = 'Pilih tanggal', required = false }) => {
    const [startDate, setStartDate] = useState(value ? new Date(value) : null);

    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) { // Valid date check
                setStartDate(date);
            } else {
                setStartDate(null);
            }
        } else {
            setStartDate(null);
        }
    }, [value]);

    const handleChange = (date) => {
        setStartDate(date);
        onChange(date ? date.toISOString().split('T')[0] : '');
    };

    const handleManualInput = (e) => {
        const inputVal = e.target.value;
        onChange(inputVal);
        if (Date.parse(inputVal)) {
            setStartDate(new Date(inputVal));
        }
    };

    return (
        <div className="relative inline-flex items-center date-input-container">
            <DatePicker
                selected={startDate}
                onChange={handleChange}
                customInput={
                    <input
                        type="text"
                        value={value || ''}
                        onChange={handleManualInput}
                        placeholder={placeholder}
                        className={`editable-input border rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-400 ${required && !value ? 'border-red-500' : 'border-gray-300'
                            }`}
                    />
                }
                dateFormat="yyyy-MM-dd"
                isClearable
                popperPlacement="bottom-start"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
            />
            <Calendar className="absolute right-3 text-gray-500 pointer-events-none" size={18} />
        </div>
    );
};

export default DateInput;
