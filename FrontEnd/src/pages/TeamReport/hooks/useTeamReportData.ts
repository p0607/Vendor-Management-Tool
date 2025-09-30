// Custom hook for Team Report data fetching and management
// Handles API calls, data loading, and state management

import { useState, useEffect, useCallback } from 'react';
import { ReportData } from '../types';
import apiClient from '../../../config/api';

export const useTeamReportData = () => {
  const [data, setData] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get('/api/team-report');
      if (response.data.success) {
        setData(response.data.data || []);
      } else {
        setError(response.data.error || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh data
  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refreshData,
    setData
  };
};
