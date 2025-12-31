import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedDesignations?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedDesignations }) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const user = localStorage.getItem('user');
    const authToken = localStorage.getItem('authToken');
    
    if (!user || !authToken) {
      // User is not authenticated, redirect to login
      navigate('/', { replace: true });
      return;
    }

    // Prevent back button navigation to login page
    const handlePopState = (e: PopStateEvent) => {
      const currentUser = localStorage.getItem('user');
      const currentToken = localStorage.getItem('authToken');
      
      if (!currentUser || !currentToken) {
        // If user logged out and tries to go back, redirect to login
        navigate('/', { replace: true });
      } else {
        // If user is logged in and tries to go back to login, prevent it
        const currentPath = window.location.hash.replace('#', '') || window.location.pathname;
        if (currentPath === '/' || currentPath === '/login') {
          navigate('/HomePage', { replace: true });
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  const user = localStorage.getItem('user');
  const authToken = localStorage.getItem('authToken');
  
  if (!user || !authToken) {
    return <Navigate to="/" replace />;
  }

  try {
    const userData = JSON.parse(user);
    const userDesignation = userData.designation?.toUpperCase() || '';

    // SUPER ADMIN has access to everything
    if (userDesignation === 'SUPER ADMIN') {
      return <>{children}</>;
    }

    // If allowedDesignations is provided, check if user has access
    if (allowedDesignations && allowedDesignations.length > 0) {
      if (allowedDesignations.includes(userDesignation)) {
        return <>{children}</>;
      }
      // User doesn't have required designation
      return <Navigate to="/HomePage" replace />;
    }

    // No specific designations required, allow access
    return <>{children}</>;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return <Navigate to="/" replace />;
  }
};

export default ProtectedRoute;

