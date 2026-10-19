/**
 * BomaWiFi - Pay-Per-Use WiFi Hotspot Management System
 * Africa/Nairobi (EAT) & Kenyan Shilling (KES)
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CustomerPortal } from './components/CustomerPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { db } from './services/firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

export default function App() {
  const [currentView, setCurrentView] = useState<'portal' | 'admin'>('portal');
  const [isSimulatedDaraja, setIsSimulatedDaraja] = useState<boolean>(true);
  const [isMockRouter, setIsMockRouter] = useState<boolean>(true);
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(1);

  // Test Firestore connection on boot as mandated by Firebase Skill
  useEffect(() => {
    async function testFirestoreConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    }
    testFirestoreConnection();
    fetchIntegrationsStatus();
  }, []);

  const fetchIntegrationsStatus = async () => {
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data = await res.json();
        setIsSimulatedDaraja(!data.daraja.isConfigured);
        setIsMockRouter(!data.router.isLive);
        if (typeof data.router.activeUsers === 'number') {
          setActiveSessionsCount(data.router.activeUsers);
        }
      }
    } catch (e) {
      console.warn('Could not fetch integration status:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        isSimulatedDaraja={isSimulatedDaraja}
        isMockRouter={isMockRouter}
        activeSessionsCount={activeSessionsCount}
      />

      <main className="flex-1 pb-16">
        {currentView === 'portal' ? (
          <CustomerPortal onRefreshStats={fetchIntegrationsStatus} />
        ) : (
          <AdminDashboard />
        )}
      </main>

      <footer className="bg-slate-900/80 border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400">
            <span>BomaWiFi Kenya HotSpot</span>
            <span>•</span>
            <span>Timezone: Africa/Nairobi (EAT, UTC+3)</span>
            <span>•</span>
            <span>Currency: Kenyan Shilling (KES)</span>
            <span>•</span>
            <span>M-Pesa STK Push Integration</span>
          </div>
          <p className="text-[11px] text-slate-600">
            Real internet access is authorized strictly after verified backend payment. Router secrets and payment credentials are kept server-side.
          </p>
        </div>
      </footer>
    </div>
  );
}
