import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';

const LoginPage = ({ user, onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const location = useLocation();
  const from = location.state?.from?.pathname || (user?.user_type === 'professor' ? '/profesor' : '/alumno');

  if (user) {
    return <Navigate to={user.user_type === 'professor' ? '/profesor' : '/alumno'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const data = await authService.login(identifier, password);
      if (data.ok) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Laboratorio Industrial</h1>
          <p>Sistema Andon - Control de Producción</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Usuario o Correo</label>
            <input 
              type="text" 
              value={identifier} 
              onChange={(e) => setIdentifier(e.target.value)} 
              placeholder="Ej: admin"
              required 
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Contraseña</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
              disabled={loading}
            />
          </div>
          
          {error && <div className="error-alert">{error}</div>}
          
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Usa <code>admin</code> / <code>admin123</code> para pruebas.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
