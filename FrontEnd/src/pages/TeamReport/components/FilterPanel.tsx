// FilterPanel component for Team Report
// Handles all filter controls (Business Unit, Client Name, BU Head)

import React from 'react';
import { Select, AutoComplete } from 'antd';
import { ReportData } from '../types';
import { 
  getUniqueBusinessUnits, 
  getUniqueClientNames, 
  getUniqueBUHeads 
} from '../utils/dataProcessing';

const { Option } = Select;

interface FilterPanelProps {
  data: ReportData[];
  selectedBusinessUnit: string | null;
  selectedClientName: string | null;
  selectedBUHead: string | null;
  onBusinessUnitChange: (value: string | null) => void;
  onClientNameChange: (value: string | null) => void;
  onBUHeadChange: (value: string | null) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  data,
  selectedBusinessUnit,
  selectedClientName,
  selectedBUHead,
  onBusinessUnitChange,
  onClientNameChange,
  onBUHeadChange
}) => {
  // Get unique values for filters
  const businessUnits = getUniqueBusinessUnits(data);
  const clientNames = getUniqueClientNames(data, selectedBusinessUnit);
  const buHeads = getUniqueBUHeads(data);

  return (
    <div style={{ 
      display: 'flex', 
      gap: '16px', 
      marginBottom: '16px',
      flexWrap: 'wrap',
      alignItems: 'flex-end'
    }}>
      {/* Business Unit Filter */}
      <div>
        <div style={{ 
          color: '#000000', 
          fontWeight: 600, 
          marginBottom: '4px',
          fontSize: '10px'
        }}>
          Business Unit
        </div>
        <Select
          value={selectedBusinessUnit || ''}
          onChange={(value) => onBusinessUnitChange(value || null)}
          style={{ 
            width: 200,
            fontSize: '12px'
          }}
          placeholder="Select Business Unit"
          allowClear
        >
          <Option value="">All Business Units</Option>
          {businessUnits.map((bu: string) => (
            <Option key={bu} value={bu}>{bu}</Option>
          ))}
        </Select>
      </div>

      {/* Client Name / Project Name Filter */}
      <div>
        <div style={{ 
          color: '#000000', 
          fontWeight: 600, 
          marginBottom: '4px',
          fontSize: '10px'
        }}>
          {selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "Project Name" : "Client Name"}
        </div>
        <AutoComplete
          value={selectedClientName || ''}
          onChange={(value) => onClientNameChange(value || null)}
          options={clientNames.map(name => ({ value: name }))}
          style={{ 
            width: 200,
            fontSize: '12px'
          }}
          placeholder={`Select ${selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "Project" : "Client"}`}
          allowClear
          filterOption={(inputValue, option) =>
            option?.value?.toLowerCase().includes(inputValue.toLowerCase()) || false
          }
        />
      </div>

      {/* BU Head Filter */}
      <div>
        <div style={{ 
          color: '#000000', 
          fontWeight: 600, 
          marginBottom: '4px',
          fontSize: '10px'
        }}>
          BU Head
        </div>
        <Select
          value={selectedBUHead || ''}
          onChange={(value) => onBUHeadChange(value || null)}
          style={{ 
            width: 200,
            fontSize: '12px'
          }}
          placeholder="Select BU Head"
          allowClear
        >
          <Option value="">All BU Heads</Option>
          {buHeads.map((head: string) => (
            <Option key={head} value={head}>{head}</Option>
          ))}
        </Select>
      </div>
    </div>
  );
};

export default FilterPanel;
