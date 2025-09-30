// Main TeamReportCompare component - Refactored
// Orchestrates all Team Report functionality with improved structure

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Select, Button, Tabs } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import styles from '../TeamReportDashboard.module.css';
import logo from '../../../assets/logo_1.png';
import ForecastChart from '../TargetTrackingChart';

// Import components
import FilterPanel from './components/FilterPanel';
import KPIDashboard from './components/KPIDashboard';
import GrowthAnalysis from './components/GrowthAnalysis';
import ImportExport from './components/ImportExport';

// Import hooks
import { useTeamReportData } from './hooks/useTeamReportData';
import { useKPICalculations } from './hooks/useKPICalculations';
import { useGrowthAnalysis } from './hooks/useGrowthAnalysis';

// Import types and utilities
import { ReportData, CompareType, CombinedPeriod } from './types';
import { getCurrentFinancialYear, getFiscalQuarter } from './utils/calculations';
import { getAvailablePeriods } from './utils/dataProcessing';

const { Option } = Select;
const { TabPane } = Tabs;

const TeamReportCompare: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Data fetching
  const { data, isLoading, error, refreshData } = useTeamReportData();

  // Filter states
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [selectedBUHead, setSelectedBUHead] = useState<string | null>(null);
  const [compareType, setCompareType] = useState<CompareType>(() => {
    const params = new URLSearchParams(location.search);
    return (params.get('compareType') as CompareType) || 'year';
  });
  const [comparisonValues, setComparisonValues] = useState<(string | null)[]>(() => {
    const params = new URLSearchParams(location.search);
    const values = params.get('comparisonValues');
    if (values) {
      try {
        return JSON.parse(decodeURIComponent(values));
      } catch (error) {
        console.warn('Failed to decode URL parameters, using defaults:', error);
      }
    }
    const currentFY = getCurrentFinancialYear();
    const previousFY = currentFY - 1;
    return [`FY ${currentFY}`, `FY ${previousFY}`];
  });

  // UI states
  const [selectedParameters, setSelectedParameters] = useState<string[]>(() => {
    const defaultParams = ['Revenue', 'GPM', 'NP', 'Team Cost'];
    return defaultParams;
  });
  const [showAllKPIs, setShowAllKPIs] = useState(false);
  const [showAllParameters, setShowAllParameters] = useState(false);
  const [isCroreMode, setIsCroreMode] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('chart');
  const [activeChartTab, setActiveChartTab] = useState<string>('none');

  // Combined periods for complex comparisons
  const [combinedPeriods, setCombinedPeriods] = useState<CombinedPeriod[]>([]);

  // Available options
  const [availableOptions, setAvailableOptions] = useState<string[]>([]);
  const [availableParameters, setAvailableParameters] = useState<string[]>([]);

  // KPI calculations
  const { kpiData } = useKPICalculations({
    data,
    selectedBusinessUnit,
    selectedClientName,
    selectedBUHead,
    compareType,
    comparisonValues
  });

  // Growth analysis
  const { growthAnalysis } = useGrowthAnalysis({
    data,
    selectedBusinessUnit,
    selectedClientName,
    selectedBUHead,
    compareType,
    comparisonValues,
    availableParameters,
    combinedPeriods
  });

  // Update available options when data changes
  useEffect(() => {
    if (data.length > 0) {
      const periods = getAvailablePeriods(data, compareType);
      setAvailableOptions(periods);
      
      const params = [
        'Revenue', 'GPM', 'GPM %', 'NP', 'NP %', 'Team Cost', 
        'HC', 'Salary Cost', 'Opr Cost', 'Funding Cost', 'Leave Encashment'
      ];
      setAvailableParameters(params);
    }
  }, [data, compareType]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('compareType', compareType);
    params.set('comparisonValues', encodeURIComponent(JSON.stringify(comparisonValues)));
    navigate(`?${params.toString()}`, { replace: true });
  }, [compareType, comparisonValues, navigate]);

  // Handle comparison type change
  const handleCompareTypeChange = (value: CompareType) => {
    setCompareType(value);
    
    // Reset comparison values based on new type
    if (value === 'year') {
      const currentFY = getCurrentFinancialYear();
      const previousFY = currentFY - 1;
      setComparisonValues([`FY ${currentFY}`, `FY ${previousFY}`]);
    } else if (value === 'quarter') {
      const currentDate = new Date();
      const currentQuarter = getFiscalQuarter(currentDate);
      const previousQuarter = getFiscalQuarter(new Date(currentDate.getFullYear(), currentDate.getMonth() - 3, 1));
      setComparisonValues([currentQuarter.label, previousQuarter.label]);
    } else {
      setComparisonValues(['', '']);
    }
  };

  // Handle comparison value change
  const handleComparisonValueChange = (index: number, value: string | null) => {
    const newValues = [...comparisonValues];
    newValues[index] = value;
    setComparisonValues(newValues);
  };

  // Handle parameter selection change
  const handleParameterChange = (value: string[]) => {
    setSelectedParameters(value);
  };

  // Toggle crore mode
  const toggleCroreMode = () => {
    setIsCroreMode(!isCroreMode);
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#e8f4f8'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#e8f4f8'
      }}>
        <div style={{ color: 'red' }}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 8px', backgroundColor: '#e8f4f8', minHeight: '100vh', color: '#000000' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid #e0e0e0',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logo} alt="Logo" style={{ height: '32px' }} />
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Team Report Dashboard</h1>
        </div>
        <ImportExport data={data} onDataUpdate={refreshData} />
      </div>

      {/* Comparison Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '16px',
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }}>
        <div>
          <div style={{ 
            color: '#000000', 
            fontWeight: 600, 
            marginBottom: '4px',
            fontSize: '10px'
          }}>
            Compare By
          </div>
          <Select
            value={compareType}
            onChange={handleCompareTypeChange}
            style={{ width: 120, fontSize: '12px' }}
          >
            <Option value="year">Year</Option>
            <Option value="quarter">Quarter</Option>
            <Option value="month">Month</Option>
          </Select>
        </div>

        {comparisonValues.map((value, index) => (
          <div key={index}>
            <div style={{ 
              color: '#000000', 
              fontWeight: 600, 
              marginBottom: '4px',
              fontSize: '10px'
            }}>
              {index === 0 ? 'Current' : 'Previous'}
            </div>
            <Select
              value={value || ''}
              onChange={(newValue) => handleComparisonValueChange(index, newValue || null)}
              style={{ width: 200, fontSize: '12px' }}
              placeholder={`Select ${index === 0 ? 'current' : 'previous'} ${compareType}`}
            >
              {availableOptions.map((option) => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          </div>
        ))}

        <Button
          type="text"
          icon={<DownOutlined />}
          onClick={toggleCroreMode}
          style={{ 
            fontSize: '12px',
            height: '32px',
            padding: '0 12px'
          }}
        >
          {isCroreMode ? 'Crore Mode' : 'Lakh Mode'}
        </Button>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        data={data}
        selectedBusinessUnit={selectedBusinessUnit}
        selectedClientName={selectedClientName}
        selectedBUHead={selectedBUHead}
        onBusinessUnitChange={setSelectedBusinessUnit}
        onClientNameChange={setSelectedClientName}
        onBUHeadChange={setSelectedBUHead}
      />

      {/* Parameter Selection */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          color: '#000000', 
          fontWeight: 600, 
          marginBottom: '4px',
          fontSize: '10px'
        }}>
          Select Parameters
        </div>
        <Select
          mode="multiple"
          value={selectedParameters}
          onChange={handleParameterChange}
          style={{ width: '100%', fontSize: '12px' }}
          placeholder="Select parameters to display"
        >
          {availableParameters.map((param) => (
            <Option key={param} value={param}>{param}</Option>
          ))}
        </Select>
      </div>

      {/* Main Content Tabs */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        style={{ marginBottom: '16px' }}
      >
        <TabPane tab="KPI Dashboard" key="kpi">
          <KPIDashboard
            kpiData={kpiData}
            showAllKPIs={showAllKPIs}
            onToggleShowAllKPIs={() => setShowAllKPIs(!showAllKPIs)}
            isCroreMode={isCroreMode}
          />
        </TabPane>

        <TabPane tab="Growth Analysis" key="growth">
          <GrowthAnalysis
            growthAnalysis={growthAnalysis}
            selectedParameters={selectedParameters}
            showAllParameters={showAllParameters}
            onToggleShowAllParameters={() => setShowAllParameters(!showAllParameters)}
            comparisonValues={comparisonValues}
            selectedBusinessUnit={selectedBusinessUnit}
            selectedClientName={selectedClientName}
            selectedBUHead={selectedBUHead}
          />
        </TabPane>

        <TabPane tab="Parameter Tracking" key="tracking">
          <ForecastChart
            selectedBusinessUnit={selectedBusinessUnit}
            selectedPeriod={comparisonValues[0]}
            compareType={compareType}
            actualData={{
              revenue: 0,
              netMargin: 0,
              period: comparisonValues[0] || ''
            }}
          />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default TeamReportCompare;
