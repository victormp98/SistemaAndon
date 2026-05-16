import { NavLink } from 'react-router-dom';

const Sidebar = ({ userType }) => {
  const professorLinks = [
    { to: '/profesor', label: 'Inicio', icon: '🏠' },
    { to: '/profesor/laboratorios', label: 'Laboratorios', icon: '🧪' },
    { to: '/profesor/alumnos', label: 'Alumnos', icon: '👥' },
    { to: '/profesor/simulaciones', label: 'Simulaciones', icon: '🎮' },
    { to: '/profesor/ordenes', label: 'Órdenes', icon: '📋' },
    { to: '/profesor/reportes', label: 'Reportes', icon: '📊' },
    { to: '/andon', label: 'Panel Andon', icon: '🔔' },
    { to: '/profesor/configuracion', label: 'Configuración', icon: '⚙️' },
  ];

  const studentLinks = [
    { to: '/alumno', label: 'Inicio', icon: '🏠' },
    { to: '/andon', label: 'Panel Andon', icon: '🔔' },
  ];

  const links = userType === 'professor' ? professorLinks : studentLinks;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo-text">ANDON SYSTEM</span>
      </div>
      
      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            end={link.to === '/profesor' || link.to === '/alumno'}
          >
            <span className="nav-icon">{link.icon}</span>
            <span className="nav-label">{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
