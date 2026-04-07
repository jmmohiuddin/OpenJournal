import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ResonanceNotification from '../Connections/ResonanceNotification';
import { useSocket } from '../../hooks/useSocket';

export default function Layout() {
  // Initialize socket connection
  useSocket();

  return (
    <div className="flex min-h-screen bg-alice-blue">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
      <ResonanceNotification />
    </div>
  );
}
