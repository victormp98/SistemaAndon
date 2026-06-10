import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const MainLayout = ({ user, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="main-layout">
      <Sidebar
        user={user}
        isOpen={menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />
      <button
        className={`sidebar-backdrop ${menuOpen ? 'visible' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-label="Cerrar menú"
      />
      
      <div className="content-area">
        <Topbar
          user={user}
          onLogout={onLogout}
          onMenuToggle={() => setMenuOpen((open) => !open)}
        />
        
        <main className="page-content">
          <Outlet />
        </main>
        
        <footer className="main-footer">
          Sistema de Control Andon v1.0.0 | Laboratorio Industrial
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;
