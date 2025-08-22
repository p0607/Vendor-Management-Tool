import { ReactNode } from 'react';

const ProtectedRoute = ({ children, allowedDesignations }) => {
  const userDesignation = localStorage.getItem('userDesignation');
  
  if (!userDesignation) {
    return <Navigate to="/" replace />;
  }

  // SUPER ADMIN has access to everything
  if (userDesignation === 'SUPER ADMIN') {
    return <>{children}</>;
  }

  if (allowedDesignations.includes(userDesignation)) {
    return <>{children}</>;
  }

  return <Navigate to="/unauthorized" replace />;
};
export default ProtectedRoute;