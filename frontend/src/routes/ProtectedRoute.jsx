import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children, user, loading, allowedRoles = [] }) => {
  const location = useLocation();

  if (loading) {
    return <div className="loading">Verificando sesión...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.user_type)) {
    return <Navigate to={user.user_type === 'professor' ? '/profesor' : '/alumno'} replace />;
  }

  return children;
};

export default ProtectedRoute;
