/**
 * BomaWiFi Application Header & Mode Switcher
 */
import React from 'react';
import { Wifi, Shield, Smartphone, Server, CheckCircle2, AlertTriangle } from 'lucide-react';

interface NavbarProps {
  currentView: 'portal' | 'admin';
  onViewChange: (view: 'portal' | 'admin') => void;
  isSimulatedDaraja: boolean;
  isMockRouter: boolean;
  activeSessionsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  isSimulatedDaraja,
  isMockRouter,
  activeSessionsCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <Wifi className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white">BomaWiFi</span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 rounded border border-emerald-500/30">
                  KENYA
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Pay-Per-Use Hotspot & M-Pesa Billing</p>
            </div>
          </div>

          {/* Integration Status Badges */}
          <div className="hidden md:flex items-center space-x-2 text-xs">
            {/* M-Pesa Mode Badge */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border ${
                isSimulatedDaraja
                  ? 'bg-amber-950/40 border-amber-600/40 text-amber-300'
                  : 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>M-Pesa: {isSimulatedDaraja ? 'Simulation Mode' : 'Live Daraja'}</span>
            </div>

            {/* Router Mode Badge */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border ${
                isMockRouter
                  ? 'bg-blue-950/40 border-blue-600/40 text-blue-300'
                  : 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Router: {isMockRouter ? 'Mock Mode' : 'MikroTik Live'}</span>
            </div>

            {/* Active Users Counter */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>{activeSessionsCount} active</span>
            </div>
          </div>

          {/* View Switcher Controls */}
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => onViewChange('portal')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'portal'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Customer Portal</span>
            </button>
            <button
              onClick={() => onViewChange('admin')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'admin'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
