// KPIDashboard component for Team Report
// Displays KPI cards with current vs previous period comparisons

import React from 'react';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { KPIData } from '../types';
import { formatValue } from '../utils/calculations';

interface KPIDashboardProps {
  kpiData: Record<string, KPIData>;
  showAllKPIs: boolean;
  onToggleShowAllKPIs: () => void;
  isCroreMode: boolean;
}

const KPIDashboard: React.FC<KPIDashboardProps> = ({
  kpiData,
  showAllKPIs,
  onToggleShowAllKPIs,
  isCroreMode
}) => {
  const formatValueWithToggle = (value: number, isCroreMode: boolean) => {
    if (isCroreMode) {
      return (value / 10000000).toFixed(2) + ' Cr';
    } else {
      return value.toLocaleString();
    }
  };

  const mainKPIs = ['Revenue', 'GPM', 'Team Cost', 'NP'];
  const additionalKPIs = ['HC', 'Salary Cost', 'Opr Cost', 'Funding Cost', 'Leave Encashment'];
  const displayKPIs = showAllKPIs ? [...mainKPIs, ...additionalKPIs] : mainKPIs;

  return (
    <div style={{ marginBottom: 32 }}>
      {/* KPI Dashboard Header */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div>
          <div style={{ 
            backgroundColor: '#000000', 
            color: '#ffffff', 
            padding: '8px 16px', 
            borderRadius: 4, 
            fontSize: 12, 
            fontWeight: 700,
            marginBottom: 4
          }}>
            KPI Dashboard
          </div>
          <div style={{ 
            width: 100, 
            height: 3, 
            backgroundColor: '#ff6b35',
            borderRadius: 2
          }} />
        </div>
        
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={onToggleShowAllKPIs}
          style={{ 
            fontSize: '10px',
            height: '24px',
            padding: '0 8px'
          }}
        >
          {showAllKPIs ? 'Show Less' : 'Show All KPIs'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '16px'
      }}>
        {displayKPIs.map((kpiName) => {
          const kpi = kpiData[kpiName];
          if (!kpi) return null;

          const formatValue = (value: number) => {
            if (kpiName === 'Revenue' || kpiName === 'GPM' || kpiName === 'Team Cost' || kpiName === 'NP' || 
                kpiName === 'Salary Cost' || kpiName === 'Opr Cost' || kpiName === 'Funding Cost' || kpiName === 'Leave Encashment') {
              return formatValueWithToggle(value, isCroreMode);
            }
            return value.toFixed(0);
          };

          return (
            <div
              key={kpiName}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                padding: '16px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                minHeight: '120px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              {/* KPI Name */}
              <div style={{ 
                fontSize: 12, 
                fontWeight: 600, 
                color: '#000000',
                marginBottom: 8
              }}>
                {kpiName}
              </div>

              {/* Current Value */}
              <div style={{ 
                fontSize: 16, 
                fontWeight: 700, 
                color: '#000000',
                marginBottom: 4
              }}>
                {formatValue(kpi.currentFY)}
              </div>

              {/* Growth Percentage */}
              <div style={{ 
                fontSize: 12, 
                fontWeight: 700, 
                color: kpi.growthPercentage >= 0 ? '#4ade80' : '#ff4d4f',
                marginBottom: 4,
                textAlign: 'center'
              }}>
                {kpi.growthPercentage >= 0 ? '+' : ''}{kpi.growthPercentage.toFixed(1)}% Growth
              </div>

              {/* Absolute Change */}
              <div style={{ 
                fontSize: 12, 
                fontWeight: 600, 
                color: kpi.currentFY - kpi.previousFY >= 0 ? '#4ade80' : '#ff4d4f',
                marginBottom: 4,
                textAlign: 'center'
              }}>
                {kpi.currentFY - kpi.previousFY >= 0 ? '+' : ''}{formatValue(kpi.currentFY - kpi.previousFY)}
              </div>

              {/* Period */}
              <div style={{ 
                fontSize: 8,
                color: '#666666',
                textAlign: 'center'
              }}>
                {kpi.period}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KPIDashboard;
