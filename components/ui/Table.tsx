import React from 'react';

// FIX: Allow passing standard HTML attributes to the table element.
const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, className, ...props }) => (
    <div className="overflow-x-auto">
        <table className={`min-w-full divide-y divide-gray-700 ${className}`} {...props}>
            {children}
        </table>
    </div>
);

// FIX: Allow passing standard HTML attributes to the thead element.
const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className, ...props }) => (
    <thead className={`bg-gray-800 ${className}`} {...props}>
        {children}
    </thead>
);

// FIX: Allow passing standard HTML attributes to the tbody element.
const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className, ...props }) => (
    <tbody className={`bg-gray-800/50 divide-y divide-gray-700 ${className}`} {...props}>
        {children}
    </tbody>
);

// FIX: Allow passing standard HTML attributes to the tr element.
const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className, ...props }) => (
    <tr className={`hover:bg-gray-700/50 transition-colors ${className}`} {...props}>
        {children}
    </tr>
);

// FIX: Allow passing standard HTML attributes to the th element.
const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, className, ...props }) => (
    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider ${className}`} {...props}>
        {children}
    </th>
);

// FIX: Allow passing standard HTML attributes like `colSpan` to the td element.
const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, className, ...props }) => (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-200 ${className}`} {...props}>
        {children}
    </td>
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };