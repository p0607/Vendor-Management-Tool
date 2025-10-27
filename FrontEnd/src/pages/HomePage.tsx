import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';
import logo from '../assets/logo_1.png';

const HomePage: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userDesignation = user.designation?.toUpperCase() || '';
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('user');
    localStorage.removeItem('userDesignation');
    localStorage.removeItem('token');
    sessionStorage.clear();
    
    // Navigate to login page
    navigate('/');
  };

  // Helper function to get current financial year for MFS redirect
  const getCurrentFinancialYear = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();
    
    // Financial year starts from April (month 4)
    // If current month is Jan-Mar (1-3), financial year is previous year
    // If current month is Apr-Dec (4-12), financial year is current year
    if (currentMonth >= 4) {
      return currentYear;
    } else {
      return currentYear - 1;
    }
  };

  const getVisibleButtons = () => {
    
    const buttons = [
      { 
        key: 'routingTable',
        label: 'Routing Table',
        path: '/RoutingTable',
        visibleTo: ['SUPER ADMIN', 'ADMIN', 'FINANCE EXECUTIVE']
      },
      { 
        key: 'cts',
        label: 'CTS',
        path: '/CTSDataTable',
        visibleTo: ['SUPER ADMIN', 'ADMIN', 'FINANCE EXECUTIVE']
      },
      { 
        key: 'teamReport',
        label: 'MFS',
        path: `/team-report/compare?compareType=quarter&selectedParameters=GPM%20%25%2CNP%20%25&chartType=bar&defaultFinancialYear=${getCurrentFinancialYear()}`,
        visibleTo: ['SUPER ADMIN', 'ADMIN', 'BU HEAD']
      }
    ];

    if (userDesignation === 'SUPER ADMIN' || userDesignation === 'ADMIN') {
      return buttons;
    }

    return buttons.filter(button => 
      button.visibleTo.some(role => role.toUpperCase() === userDesignation)
    );
  };

  React.useEffect(() => {
    document.body.style.backgroundColor = "#e8f4f8";
    document.body.style.fontFamily = "'Montserrat', sans-serif";
    return () => { 
      document.body.style.backgroundColor = "";
      document.body.style.fontFamily = "";
    };
  }, []);

  return (
    <div className="homepage" style={{ 
      backgroundColor: '#e8f4f8',
      minHeight: '100vh',
      color: '#000000',
      alignItems: 'center'
    }}>
      <div className="homepage-logo-top-left">
      <img src="/static/media/logo_1.fc31060d17d32e4105b3.png" alt="Alchemy Logo" />
      </div>
      <div className="auth-buttons-container">
        {(userDesignation === 'SUPER ADMIN' || userDesignation === 'ADMIN') && (
          <button 
            className="auth-button"
            onClick={() => navigate('/SignUp')}
          >
            Sign Up
          </button>  
        )}
        <button 
          className="auth-button"
          onClick={handleLogout} 
        >
          Logout
        </button>  
      </div>
      <div className="main-content">
        <div className="welcome-card">
          <h1>Welcome to FINANCIALS </h1>
          
          <div className="sticky-note-buttons">
            {getVisibleButtons().map(button => (
              <button
                key={button.key}
                className="sticky-note"
                onClick={() => navigate(button.path)}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;