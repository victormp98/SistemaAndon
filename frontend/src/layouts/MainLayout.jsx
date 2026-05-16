import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const MainLayout = ({ user, onLogout }) => {
  return (
    <div className="main-layout">
      <Sidebar userType={user?.user_type} />
      
      <div className="content-area">
        <Topbar user={user} onLogout={onLogout} />
        
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
