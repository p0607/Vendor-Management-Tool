import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RoutingTable from './pages/RoutingTable'; 
import RoutingDashboard from './pages/RoutingDashboard'; 
import RoutingDashboardBarChart from './pages/RoutingDashboardBarChart'; 
import AddRoutingData from './pages/AddRoutingData';
import RoutingDashboardLineChart from './pages/RoutingDashboardLineChart';
import VendorBarChart from './pages/VendorBarChart';
import CTSDataTable from './pages/CTSDataTable';
import CTSDashboard from './pages/CTSDashboard';
import AddCTSData from './pages/AddCTSData';
import AddActiveData from './pages/AddActiveData';
import AddAttritionData from './pages/AddAttritionData';
import CTSDataView from './pages/CTSDataView';
import VendorGanttChart from './pages/VendorGanttChart';
import VendorResourcePieAnalysis from './pages/VendorResourcePieAnalysis';
import AddTeamReportData from './pages/AddTeamReportData';
import AddHRMSData from './pages/AddHRMSData';
import TeamReportCompare from "./pages/TeamReportCompare";
import ClientMFSCompare from "./pages/ClientMFSCompare";
import MFSdata from "./pages/MFSdata";
import ClientMFSdata from "./pages/ClientMFSdata";

const App: React.FC = () => {
  // Set document title
  useEffect(() => {
    document.title = 'Financials';
  }, []);

  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/HomePage"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/SignUp"
          element={
            <ProtectedRoute allowedDesignations={['SUPER ADMIN', 'ADMIN']}>
              <SignUp />
            </ProtectedRoute>
          }
        />
        <Route path="/forgot_password" element={<ForgotPassword />} />
        <Route 
          path="/reset-password" 
          element={
            <ProtectedRoute allowedDesignations={['SUPER ADMIN', 'ADMIN']}>
              <ResetPassword />
            </ProtectedRoute>
          } 
        />
        <Route path="/RoutingTable" element={<ProtectedRoute><RoutingTable /></ProtectedRoute>} />
        <Route path="/RoutingDashboard" element={<ProtectedRoute><RoutingDashboard /></ProtectedRoute>} />
        <Route path="/RoutingDashboardBarChart" element={<ProtectedRoute><RoutingDashboardBarChart data={[]} /></ProtectedRoute>} />
        <Route path="/AddRoutingData" element={<ProtectedRoute><AddRoutingData /></ProtectedRoute>} />
        <Route path="/RoutingDashboardLineChart" element={<ProtectedRoute><RoutingDashboardLineChart data={[]} /></ProtectedRoute>} />
        <Route path="/VendorBarChart" element={<ProtectedRoute><VendorBarChart data={[]} /></ProtectedRoute>} />
        <Route path="/CTSDataTable" element={<ProtectedRoute><CTSDataTable /></ProtectedRoute>} />
        <Route path="/CTSDashboard" element={<ProtectedRoute><CTSDashboard /></ProtectedRoute>} />
        <Route path="/AddCTSData" element={<ProtectedRoute><AddCTSData /></ProtectedRoute>} />
        <Route path="/AddActiveData" element={<ProtectedRoute><AddActiveData /></ProtectedRoute>} />
        <Route path="/AddAttritionData" element={<ProtectedRoute><AddAttritionData /></ProtectedRoute>} />
        <Route path="/CTSDataView" element={<ProtectedRoute><CTSDataView /></ProtectedRoute>} />
        <Route path="/VendorGanttChart" element={<ProtectedRoute><VendorGanttChart data={[]} view="monthly" metric="head_count" /></ProtectedRoute>} />
        <Route path="/VendorResourcePieAnalysis" element={<ProtectedRoute><VendorResourcePieAnalysis data={[]} /></ProtectedRoute>} />
        <Route path="/AddTeamReportData" element={<ProtectedRoute><AddTeamReportData /></ProtectedRoute>} />
        <Route path="/AddHRMSData" element={<ProtectedRoute><AddHRMSData /></ProtectedRoute>} />
        <Route path="/team-report/compare" element={<ProtectedRoute><TeamReportCompare /></ProtectedRoute>} />
        <Route path="/client-mfs/compare" element={<ProtectedRoute><ClientMFSCompare /></ProtectedRoute>} />
        <Route path="/mfs-data" element={<ProtectedRoute><MFSdata /></ProtectedRoute>} />
        <Route path="/client-mfs-data" element={<ProtectedRoute><ClientMFSdata /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
};

export default App;