

import React, { useState } from 'react';
// FIX: Import 'toast' from 'react-hot-toast' to resolve "Cannot find name 'toast'" error.
import toast from 'react-hot-toast';
import Input from './Input';
import Button from './Button';

interface DateRange {
  start: string;
  end: string;
}

interface DateRangePickerProps {
  onRangeChange: (range: DateRange) => void;
  initialRange?: DateRange;
}

const formatDate = (date: Date) => {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ onRangeChange, initialRange }) => {
  const today = new Date();
  
  const defaultStartDate = new Date();
  defaultStartDate.setDate(today.getDate() - 30);

  const [startDate, setStartDate] = useState(initialRange ? initialRange.start : formatDate(defaultStartDate));
  const [endDate, setEndDate] = useState(initialRange ? initialRange.end : formatDate(today));

  const handleApply = () => {
    if (new Date(startDate) > new Date(endDate)) {
        toast.error("Start date cannot be after end date.");
        return;
    }
    onRangeChange({ start: startDate, end: endDate });
  };
  
  const setPresetRange = (preset: '7d' | '30d' | 'month') => {
      const end = new Date();
      let start = new Date();
      
      if (preset === '7d') {
          start.setDate(end.getDate() - 7);
      } else if (preset === '30d') {
          start.setDate(end.getDate() - 30);
      } else { // this month
          start = new Date(end.getFullYear(), end.getMonth(), 1);
      }
      
      const newRange = { start: formatDate(start), end: formatDate(end) };
      setStartDate(newRange.start);
      setEndDate(newRange.end);
      onRangeChange(newRange);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-800/50 rounded-lg mb-6 border border-gray-700">
      <div className="flex flex-wrap items-center gap-4">
        <Input
          type="date"
          label="Start Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full sm:w-auto"
          id="start-date"
        />
        <Input
          type="date"
          label="End Date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full sm:w-auto"
          id="end-date"
        />
         <Button onClick={handleApply} className="self-end">Update Range</Button>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-end">
          <Button variant="ghost" size="sm" onClick={() => setPresetRange('7d')}>Last 7 Days</Button>
          <Button variant="ghost" size="sm" onClick={() => setPresetRange('30d')}>Last 30 Days</Button>
          <Button variant="ghost" size="sm" onClick={() => setPresetRange('month')}>This Month</Button>
      </div>
    </div>
  );
};

export default DateRangePicker;
