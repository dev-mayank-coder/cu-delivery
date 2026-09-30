import React from 'react';
import { DeliveryAuthProvider, useDeliveryAuth } from './context/DeliveryAuthContext';
import DeliveryLoginPage from './pages/DeliveryLoginPage';
import DeliveryDashboard from './pages/DeliveryDashboard';

function DeliveryRoot() {
  const { isAuthenticated } = useDeliveryAuth();

  if (!isAuthenticated) {
    return <DeliveryLoginPage />;
  }

  return <DeliveryDashboard />;
}

export default function App() {
  return (
    <DeliveryAuthProvider>
      <DeliveryRoot />
    </DeliveryAuthProvider>
  );
}
