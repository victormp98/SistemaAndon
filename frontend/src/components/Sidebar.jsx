import { NavLink } from 'react-router-dom';

const Sidebar = ({ user, isOpen, onNavigate }) => {
  const professorLinks = [
    { to: '/profesor', label: 'Inicio', icon: '🏠' },
    { to: '/profesor/laboratorios', label: 'Laboratorios', icon: '🧪' },
    { to: '/profesor/alumnos', label: 'Alumnos', icon: '👥' },
    { to: '/profesor/simulaciones', label: 'Simulaciones', icon: '🎮' },
    { to: '/profesor/ordenes', label: 'Órdenes', icon: '📋' },
    { to: '/profesor/reportes', label: 'Reportes', icon: '📊' },
    { to: '/profesor/incidentes', label: 'Incidentes', icon: '!' },
    { to: '/andon', label: 'Panel Andon', icon: '🔔' },
    { to: '/profesor/configuracion', label: 'Configuración', icon: '⚙️' },
    { to: '/profesor/respaldos', label: 'Respaldos', icon: 'R' },
    { to: '/profesor/auditoria', label: 'Auditoría', icon: 'A' },
  ];
  if (user?.is_admin) professorLinks.splice(3, 0, { to: '/profesor/profesores', label: 'Profesores', icon: 'P' });

  const studentLinks = [
    { to: '/alumno', label: 'Inicio', icon: '🏠' },
    { to: '/andon', label: 'Panel Andon', icon: '🔔' },
  ];

  const links = user?.user_type === 'professor' ? professorLinks : studentLinks;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
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
            onClick={onNavigate}
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
