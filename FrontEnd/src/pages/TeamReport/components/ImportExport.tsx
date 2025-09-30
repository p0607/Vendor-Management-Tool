// ImportExport component for Team Report
// Handles Excel import and export functionality

import React from 'react';
import { Dropdown, message, Button } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { ReportData } from '../types';
import { processExcelData } from '../utils/dataProcessing';
import * as XLSX from 'xlsx';
import apiClient from '../../../config/api';

interface ImportExportProps {
  data: ReportData[];
  onDataUpdate: (newData: ReportData[]) => void;
}

const ImportExport: React.FC<ImportExportProps> = ({
  data,
  onDataUpdate
}) => {
  // Handle Excel import
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = XLSX.readFile(file);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        message.error('No data found in the Excel file');
        return;
      }

      // Process the data
      const processedData = processExcelData(jsonData);
      
      // Validate required fields
      const invalidRecords = processedData.filter(record => 
        !record.month || !record.year
      );

      if (invalidRecords.length > 0) {
        message.error(`${invalidRecords.length} records are missing required month/year data`);
        return;
      }

      // Import data in batches
      const batchSize = 50;
      const totalBatches = Math.ceil(processedData.length / batchSize);
      let successCount = 0;
      let errorCount = 0;

      message.loading(`Importing ${processedData.length} records... (0/${totalBatches} batches)`, 0);

      for (let i = 0; i < processedData.length; i += batchSize) {
        const batch = processedData.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        try {
          const response = await apiClient.post('/api/team-report/bulk', {
            data: batch
          });

          if (response.data.success) {
            successCount += batch.length;
          } else {
            errorCount += batch.length;
          }

          // Update progress message
          message.loading(`Importing ${processedData.length} records... (${batchNumber}/${totalBatches} batches completed)`, 0);

        } catch (error: any) {
          errorCount += batch.length;
          console.error(`Batch ${batchNumber} failed:`, error);
        }
      }

      message.destroy();

      if (successCount === processedData.length) {
        message.success(`Successfully imported ${successCount} records`);
        // Refresh data
        window.location.reload();
      } else if (successCount > 0) {
        message.warning(`Imported ${successCount} records successfully, ${errorCount} records failed.`);
      } else {
        message.error('Import failed. Please check your data format and try again.');
      }

    } catch (error: any) {
      message.error(`Import failed: ${error.message}`);
    }
  };

  // Handle Excel export
  const handleExportExcel = () => {
    const exportData = data.map((row: ReportData) => ({
      'Tower': row.tower || '',
      'Client_name': row.client_name || '',
      'Project_name': row.project_name || '',
      'Business_unit': row.business_unit || '',
      'BU_Head': row.bu_head || '',
      'HC': row.hc || 0,
      'Salary Cost': row.salary_cost || 0,
      'SALES': row.sales || 0,
      'GPM': row.gpm || 0,
      'GPM %': row.gpm_percentage || 0,
      'Loan Encash': row.leave_encashment || 0,
      'Team Cost': row.team_cost || 0,
      'Opr Cost': row.opr_cost || 0,
      'Funding Cost': row.funding_cost || 0,
      'NP': row.np || 0,
      'NP %': row.np_percentage || 0,
      'Month': row.month || '',
      'Year': row.year || new Date().getFullYear()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Team Report Data');
    
    const fileName = `team_report_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    message.success('Data exported successfully');
  };

  const menuItems = [
    {
      key: 'import',
      label: 'Import Excel',
      onClick: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls';
        input.onchange = (e) => handleImportExcel(e as any);
        input.click();
      }
    },
    {
      key: 'export',
      label: 'Export Excel',
      onClick: handleExportExcel
    }
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
    >
      <Button
        type="text"
        icon={<DownOutlined />}
        style={{ 
          fontSize: '12px',
          height: '32px',
          padding: '0 12px'
        }}
      >
        Data Actions
      </Button>
    </Dropdown>
  );
};

export default ImportExport;
