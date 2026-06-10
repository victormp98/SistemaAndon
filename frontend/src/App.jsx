import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import authService from './services/authService';

// Layouts & Routes
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './routes/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import ProfessorDashboardPage from './pages/ProfessorDashboardPage';
import LaboratoriesPage from './pages/LaboratoriesPage';
import StudentsPage from './pages/StudentsPage';
import SimulationsPage from './pages/SimulationsPage';
import OrdersPage from './pages/OrdersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import StudentHomePage from './pages/StudentHomePage';
import AndonPage from './pages/AndonPage';
import IncidentsPage from './pages/IncidentsPage';
import ChangePasswordPage from './pages/ChangePasswordPage';

// Styles
import './styles/global.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const verifySession = useCallback(async () => {
    try {
      const data = await authService.me();
      if (data.ok) {
        setUser(data.user);
      } else {
        setUser(null);
        authService.logout();
      }
    } catch (err) {
      console.error('Session verification error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  if (loading) {
    return <div className="loading-screen">Cargando Sistema...</div>;
  }

  if (user?.must_change_password) {
    return (
      <ChangePasswordPage
        onChanged={() => setUser({ ...user, must_change_password: 0 })}
      />
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage user={user} onLoginSuccess={handleLoginSuccess} />} />
        
        {/* Protected Professor Routes */}
        <Route 
          path="/profesor" 
          element={
            <ProtectedRoute user={user} loading={loading} allowedRoles={['professor']}>
              <MainLayout user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProfessorDashboardPage />} />
          <Route path="laboratorios" element={<LaboratoriesPage />} />
          <Route path="alumnos" element={<StudentsPage />} />
          <Route path="simulaciones" element={<SimulationsPage />} />
          <Route path="ordenes" element={<OrdersPage />} />
          <Route path="reportes" element={<ReportsPage />} />
          <Route path="incidentes" element={<IncidentsPage />} />
          <Route path="configuracion" element={<SettingsPage />} />
        </Route>

        {/* Protected Student Routes */}
        <Route 
          path="/alumno" 
          element={
            <ProtectedRoute user={user} loading={loading} allowedRoles={['student']}>
              <MainLayout user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentHomePage />} />
        </Route>

        {/* Semi-public Andon (Requires any authenticated user) */}
        <Route 
          path="/andon" 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <MainLayout user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        >
          <Route index element={<AndonPage />} />
        </Route>

        {/* Fallback */}
        <Route path="/" element={<Navigate to={user ? (user.user_type === 'professor' ? '/profesor' : '/alumno') : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
