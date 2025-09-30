// GrowthAnalysis component for Team Report
// Displays growth analysis table and charts

import React from 'react';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { GrowthAnalysis as GrowthAnalysisType, CompareType } from '../types';
import { formatValueForTable } from '../../../utils/formatUtils';

interface GrowthAnalysisProps {
  growthAnalysis: GrowthAnalysisType[];
  selectedParameters: string[];
  showAllParameters: boolean;
  onToggleShowAllParameters: () => void;
  comparisonValues: (string | null)[];
  selectedBusinessUnit: string | null;
  selectedClientName: string | null;
  selectedBUHead: string | null;
}

const GrowthAnalysis: React.FC<GrowthAnalysisProps> = ({
  growthAnalysis,
  selectedParameters,
  showAllParameters,
  onToggleShowAllParameters,
  comparisonValues,
  selectedBusinessUnit,
  selectedClientName,
  selectedBUHead
}) => {
  if (comparisonValues.filter(Boolean).length < 2 || growthAnalysis.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
      {/* Growth Analysis Header */}
      <div style={{ 
        backgroundColor: '#000000', 
        color: '#ffffff', 
        padding: '8px 16px', 
        borderRadius: 4, 
        fontSize: 12, 
        fontWeight: 700,
        display: 'inline-block',
        marginBottom: 8,
        borderBottom: '3px solid #ff8c00'
      }}>
        Growth Analysis Report
      </div>

      <p style={{ marginBottom: 8, color: '#000000', fontSize: 10 }}>
        Comparing {comparisonValues.filter(Boolean).join(' vs ')} for {selectedBusinessUnit || "All Business Units"}
        {selectedClientName && ` - ${selectedBusinessUnit === "Managed Services" || selectedBusinessUnit === "MS" ? "Project" : "Client"}: ${selectedClientName}`}
        {selectedBUHead && ` - BU Head: ${selectedBUHead}`}
      </p>

      {/* Show All Parameters Button */}
      <div style={{ marginBottom: 8 }}>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={onToggleShowAllParameters}
          style={{ 
            fontSize: '10px',
            height: '24px',
            padding: '0 8px'
          }}
        >
          {showAllParameters ? 'Show Selected Only' : 'Show All Parameters'}
        </Button>
      </div>

      {/* Growth Analysis Table */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #e0e0e0', 
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ 
                padding: '8px 12px', 
                textAlign: 'left', 
                fontWeight: 600, 
                color: '#000000', 
                fontSize: '10px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                Parameter
              </th>
              {comparisonValues.filter(Boolean).map((period, index) => (
                <th key={index} style={{ 
                  padding: '8px 12px', 
                  textAlign: 'right', 
                  fontWeight: 600, 
                  color: '#000000', 
                  fontSize: '10px',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  {period}
                </th>
              ))}
              <th style={{ 
                padding: '8px 12px', 
                textAlign: 'right', 
                fontWeight: 600, 
                color: '#000000', 
                fontSize: '10px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                Growth %
              </th>
              <th style={{ 
                padding: '8px 12px', 
                textAlign: 'right', 
                fontWeight: 600, 
                color: '#000000', 
                fontSize: '10px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {(showAllParameters ? growthAnalysis : growthAnalysis.filter(item => selectedParameters.includes(item.parameter))).map((item, index) => {
              // Calculate growth between first and last period for each parameter
              const firstPeriodAmount = item.periodValues[0]?.amount || 0;
              const lastPeriodAmount = item.periodValues[item.periodValues.length - 1]?.amount || 0;
              const absoluteChange = lastPeriodAmount - firstPeriodAmount;
              const growthPercentage = firstPeriodAmount !== 0 
                ? ((absoluteChange) / firstPeriodAmount) * 100 
                : lastPeriodAmount !== 0 ? Infinity : 0;

              return (
                <tr key={index} style={{ 
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500, color: '#000000', fontSize: '10px' }}>
                    {item.parameter}
                  </td>
                  {item.periodValues.filter(pv => pv.period).map((pv, i) => (
                    <td key={i} style={{ padding: '6px 8px', textAlign: 'right', color: '#000000', fontSize: '10px' }}>
                      {formatValueForTable(pv.amount, item.parameter)}
                    </td>
                  ))}
                  <td style={{ 
                    padding: '6px 8px', 
                    textAlign: 'right', 
                    color: growthPercentage >= 0 ? '#4ade80' : '#ff4d4f', 
                    fontSize: '10px',
                    fontWeight: 600
                  }}>
                    {growthPercentage === Infinity ? '∞' : 
                     growthPercentage >= 0 ? '+' : ''}{growthPercentage === Infinity ? '' : growthPercentage.toFixed(1)}%
                  </td>
                  <td style={{ 
                    padding: '6px 8px', 
                    textAlign: 'right', 
                    color: absoluteChange >= 0 ? '#4ade80' : '#ff4d4f', 
                    fontSize: '10px',
                    fontWeight: 600
                  }}>
                    {absoluteChange >= 0 ? '+' : ''}{formatValueForTable(absoluteChange, item.parameter)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Top Growth and Decline Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px',
        marginTop: 16
      }}>
        {/* Top Growth */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e0e0e0', 
          borderRadius: 8,
          padding: '12px'
        }}>
          <div style={{ 
            backgroundColor: '#4ade80', 
            color: '#ffffff', 
            padding: '6px 12px', 
            borderRadius: 4, 
            fontSize: 10, 
            fontWeight: 600,
            marginBottom: 8,
            borderBottom: '3px solid #22c55e'
          }}>
            Top Growth
          </div>
          {growthAnalysis
            .flatMap(item => 
              item.changes
                .filter(change => change.isPositive)
                .map(change => ({
                  ...change,
                  parameter: item.parameter
                }))
            )
            .sort((a, b) => b.percentageChange - a.percentageChange)
            .slice(0, 3)
            .map((change, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '9px',
                marginBottom: '4px',
                color: '#000000'
              }}>
                <span>{change.parameter}</span>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                  +{change.percentageChange.toFixed(1)}%
                </span>
              </div>
            ))}
        </div>

        {/* Top Decline */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e0e0e0', 
          borderRadius: 8,
          padding: '12px'
        }}>
          <div style={{ 
            backgroundColor: '#ff4d4f', 
            color: '#ffffff', 
            padding: '6px 12px', 
            borderRadius: 4, 
            fontSize: 10, 
            fontWeight: 600,
            marginBottom: 8,
            borderBottom: '3px solid #dc2626'
          }}>
            Top Decline
          </div>
          {growthAnalysis
            .flatMap(item => 
              item.changes
                .filter(change => !change.isPositive)
                .map(change => ({
                  ...change,
                  parameter: item.parameter
                }))
            )
            .sort((a, b) => a.percentageChange - b.percentageChange)
            .slice(0, 3)
            .map((change, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '9px',
                marginBottom: '4px',
                color: '#000000'
              }}>
                <span>{change.parameter}</span>
                <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
                  {change.percentageChange.toFixed(1)}%
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #e0e0e0', 
        borderRadius: 8,
        padding: '12px',
        marginTop: 16
      }}>
        <div style={{ 
          backgroundColor: '#ff8c00', 
          color: '#ffffff', 
          padding: '6px 12px', 
          borderRadius: 4, 
          fontSize: 10, 
          fontWeight: 600,
          marginBottom: 8,
          borderBottom: '3px solid #ff8c00'
        }}>
          Summary
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: '10px' }}>Parameters Increased:</span>
          <span style={{ fontWeight: 500, color: '#000000', fontSize: '10px' }}>
            {growthAnalysis
              .flatMap(item => item.changes)
              .filter(change => change.isPositive).length}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: '10px' }}>Parameters Decreased:</span>
          <span style={{ fontWeight: 500, color: '#000000', fontSize: '10px' }}>
            {growthAnalysis
              .flatMap(item => item.changes)
              .filter(change => !change.isPositive).length}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: '10px' }}>Highest Growth:</span>
          <span style={{ fontWeight: 500, color: '#000000', fontSize: '10px' }}>
            {growthAnalysis.length > 0 
              ? `${Math.max(...growthAnalysis.flatMap(item => 
                  item.changes.map(c => c.percentageChange))).toFixed(2)}%`
              : '-'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GrowthAnalysis;
