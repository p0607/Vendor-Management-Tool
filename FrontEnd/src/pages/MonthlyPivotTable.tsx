import React, { useMemo } from 'react';
import './MonthlyPivotTable.css';
import { formatValueByFieldType } from '../utils/formatUtils';

interface ReportData {
  business_unit: string;
  particulars: string;
  amount: number;
  month: string; // ISO format
}

interface Props {
  data: ReportData[];
  showBusinessUnit?: boolean;
  onRowClick?: (businessUnit: string, particulars: string) => void;
}

const formatAmount = (amount: number, particulars: string) => formatValueByFieldType(amount, particulars);

const MonthlyPivotTable: React.FC<Props> = ({ 
  data, 
  showBusinessUnit = true,
  onRowClick 
}) => {
  // Memoized calculations for better performance
  const { months, rows } = useMemo(() => {
    // Get all unique months sorted chronologically
    const months = Array.from(new Set(data.map(d => d.month)))
      .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime())
      .map(date => new Date(date).toLocaleString("default", { 
        month: 'short', 
        year: '2-digit' 
      }));

    // Group and aggregate data
    const grouped = data.reduce((acc, curr) => {
      const key = `${curr.business_unit}|||${curr.particulars}`;
      const monthLabel = new Date(curr.month).toLocaleString("default", { 
        month: 'short', 
        year: '2-digit' 
      });
      
      if (!acc[key]) {
        acc[key] = { 
          business_unit: curr.business_unit, 
          particulars: curr.particulars, 
          monthly: {}, 
          total: 0 
        };
      }
      
      acc[key].monthly[monthLabel] = (acc[key].monthly[monthLabel] || 0) + curr.amount;
      acc[key].total += curr.amount;
      return acc;
    }, {} as Record<string, { 
      business_unit: string, 
      particulars: string, 
      monthly: Record<string, number>, 
      total: number 
    }>);

    return { 
      months, 
      rows: Object.values(grouped) 
    };
  }, [data]);

  // Handle row click
  const handleRowClick = (businessUnit: string, particulars: string) => {
    if (onRowClick) {
      onRowClick(businessUnit, particulars);
    }
  };

  return (
    <div className="pivot-container">
      <div className="pivot-scroll-container">
        <table className="pivot-table" aria-label="Monthly Financial Report">
       
<thead>
  <tr>
    {showBusinessUnit && <th className="sticky-col sticky-col-lob">LOB</th>}
    <th className="sticky-col sticky-col-particulars">Particulars</th>
    {months.map(month => (
      <th key={month} scope="col">
        {month}
      </th>
    ))}
  </tr>
</thead>
<tbody>
  {rows.map((row, idx) => (
    <tr
      key={`${row.business_unit}-${row.particulars}-${idx}`}
      onClick={() => handleRowClick(row.business_unit, row.particulars)}
      className={onRowClick ? 'clickable-row' : ''}
    >
      {showBusinessUnit && <td className="sticky-col sticky-col-lob">{row.business_unit}</td>}
      <td className="sticky-col sticky-col-particulars">{row.particulars}</td>
             {months.map(month => (
         <td key={month} className="text-right">
           {row.monthly[month] ? formatAmount(row.monthly[month], row.particulars) : "-"}
         </td>
       ))}
    </tr>
  ))}
</tbody>

        </table>
      </div>
    </div>
  );
};

export default MonthlyPivotTable;