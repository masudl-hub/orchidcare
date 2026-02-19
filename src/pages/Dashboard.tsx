import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Dashboard from '@/components/dashboard/Dashboard';

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Redirect /dashboard to /dashboard/collection
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      navigate('/dashboard/collection', { replace: true });
    }
  }, [location, navigate]);
  
  return <Dashboard />;
}
