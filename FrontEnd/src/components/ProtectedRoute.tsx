import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedDesignations?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedDesignations }) => {
  const user = localStorage.getItem('user');
  
  if (!user) {
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

