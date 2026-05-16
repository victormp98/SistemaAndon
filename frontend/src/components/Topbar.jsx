import ServerStatus from './ServerStatus';

const Topbar = ({ user, onLogout }) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="app-title-mini">Laboratorio Industrial</h2>
      </div>
      
      <div className="topbar-right">
        <ServerStatus />
        
        <div className="user-profile-mini">
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.user_type}</span>
          </div>
          <button onClick={onLogout} className="btn-logout-mini">
            <span className="icon">🚪</span> Salir
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
