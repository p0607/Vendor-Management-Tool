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
        label: 'Team Report MoM',
        path: '/TeamReportDashboard',
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
    document.body.style.backgroundColor = "#002542";
    document.body.style.fontFamily = "'Montserrat', sans-serif";
    return () => { 
      document.body.style.backgroundColor = "";
      document.body.style.fontFamily = "";
    };
  }, []);

  return (
    <div className="homepage" style={{ 
      backgroundColor: '#002542',
      minHeight: '100vh',
      color: 'white',
      alignItems: 'center'
    }}>
      <div className="homepage-logo-top-left">
      <img src={logo} alt="Alchemy Logo" />
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
          <h1>Welcome to VMT <br/> (Vendor Management Tool)</h1>
         
          <h2>Where would you like to start?</h2>
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