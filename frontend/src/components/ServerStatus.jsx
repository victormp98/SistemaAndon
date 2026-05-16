import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const ServerStatus = () => {
  const [apiStatus, setApiStatus] = useState('Checking...');
  const [socketStatus, setSocketStatus] = useState('Disconnected');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/health');
        const data = await response.json();
        setApiStatus(data.ok ? 'Online' : 'Error');
      } catch (error) {
        setApiStatus('Offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    const socket = io('http://localhost:3000');
    socket.on('connect', () => setSocketStatus('Connected'));
    socket.on('disconnect', () => setSocketStatus('Disconnected'));

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  return (
    <div className="server-status">
      <span className={`status-pill ${apiStatus === 'Online' ? 'success' : 'error'}`}>
        API: {apiStatus}
      </span>
      <span className={`status-pill ${socketStatus === 'Connected' ? 'success' : 'error'}`}>
        Socket: {socketStatus}
      </span>
    </div>
  );
};

export default ServerStatus;
