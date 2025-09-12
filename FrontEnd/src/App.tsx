import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import RoutingTable from './pages/RoutingTable'; 
import RoutingDashboard from './pages/RoutingDashboard'; 
import RoutingDashboardBarChart from './pages/RoutingDashboardBarChart'; 
import AddRoutingData from './pages/AddRoutingData';
import RoutingDashboardLineChart from './pages/RoutingDashboardLineChart';
import VendorBarChart from './pages/VendorBarChart';
import CTSDataTable from './pages/CTSDataTable';
import CTSDashboard from './pages/CTSDashboard';
import AddCTSData from './pages/AddCTSData'
import VendorGanttChart from './pages/VendorGanttChart';
import VendorResourcePieAnalysis from './pages/VendorResourcePieAnalysis';
import AddTeamReportData from './pages/AddTeamReportData';
import AddHRMSData from './pages/AddHRMSData';
import TeamReportCompare from "./pages/TeamReportCompare";

const App: React.FC = () => {
  return (
    <Router basename="/">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/HomePage" element={<HomePage/>} />
        <Route path="/SignUp" element={<SignUp/>} />
        <Route path="/forgot_password" element={<ForgotPassword />} />
        <Route path="/RoutingTable" element={<RoutingTable />} />
        <Route path="/RoutingDashboard" element={<RoutingDashboard/>} />
        <Route path="/RoutingDashboardBarChart" element={<RoutingDashboardBarChart data={[]} />} />
        <Route path="/AddRoutingData" element={<AddRoutingData />} />
        <Route path="/RoutingDashboardLineChart" element={<RoutingDashboardLineChart data={[]} />} />
        <Route path="/VendorBarChart" element={<VendorBarChart data={[]} />} />
        <Route path="/CTSDataTable" element={<CTSDataTable />} />
        <Route path="/CTSDashboard" element={<CTSDashboard />} />
        <Route path="/AddCTSData" element={<AddCTSData />} />
        <Route path="/VendorGanttChart" element={<VendorGanttChart data={[]} view="monthly" metric="head_count" />} />
        <Route path="/VendorResourcePieAnalysis" element={<VendorResourcePieAnalysis data={[]} />} />
        <Route path="/AddTeamReportData" element={<AddTeamReportData />} />
        <Route path="/AddHRMSData" element={<AddHRMSData />} />
        <Route path="/team-report/compare" element={<TeamReportCompare />} />
      </Routes>
    </Router>
  );
};

export default App;