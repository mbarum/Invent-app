import React from 'react';
import Input from './Input';

interface DateRange {
    start: string;
    end: string;
}

interface DateRangePickerProps {
    range: DateRange;
    onRangeChange: (range: DateRange) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ range, onRangeChange }) => {

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onRangeChange({ start: e.target.value, end: range.end });
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onRangeChange({ start: range.start, end: e.target.value });
    };

    return (
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg sm:w-auto">
            <Input
                label="Start Date"
                type="date"
                value={range.start}
                onChange={handleStartDateChange}
            />
            <Input
                label="End Date"
                type="date"
                value={range.end}
                onChange={handleEndDateChange}
            />
        </div>
    );
};

export default DateRangePicker;