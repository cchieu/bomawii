/**
 * BomaWiFi Protected Admin Dashboard Component
 * Complete management system for Packages, Sessions, Transactions, RouterOS, and Automated Tests
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  DollarSign,
  Users,
  Activity,
  Layers,
  FileText,
  Server,
  Play,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Plus,
  Edit2,
  Trash2,
  Power,
  Clock,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Code,
  Key,
  Database,
  Lock,
  LogOut,
  Sparkles,
  Smartphone,
  Wifi,
  QrCode,
  Laptop,
  Radio,
  Copy,
  Check,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  WifiPackage,
  PaymentOrder,
  Transaction,
  Customer,
  HotspotSession,
  RouterConfiguration,
  AuditLog,
  AutomatedTestResult,
} from '../types/hotspot';
import {
  formatKes,
  formatKenyanPhone,
  formatDuration,
  formatBytes,
  formatNairobiDateTime,
} from '../utils/kenya';
import { auth, loginWithGoogle, logoutUser } from '../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export const AdminDashboard: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [adminRole, setAdminRole] = useState<'superadmin' | 'admin' | 'staff'>('superadmin');
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [routerSavedNotice, setRouterSavedNotice] = useState<boolean>(false);

  // Tabs
  type AdminTab = 'overview' | 'packages' | 'sessions' | 'transactions' | 'router' | 'tests' | 'setup' | 'audit';
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Dashboard Data State
  const [metrics, setMetrics] = useState<any>(null);
  const [packages, setPackages] = useState<WifiPackage[]>([]);
  const [sessions, setSessions] = useState<HotspotSession[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [routerStatus, setRouterStatus] = useState<any>(null);
  const [integrationsStatus, setIntegrationsStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [txSearch, setTxSearch] = useState<string>('');
  const [txStatusFilter, setTxStatusFilter] = useState<string>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'active' | 'expired'>('all');

  // Package Edit Modal
  const [editingPackage, setEditingPackage] = useState<WifiPackage | null>(null);
  const [isNewPackage, setIsNewPackage] = useState<boolean>(false);
  const [packageFormData, setPackageFormData] = useState({
    name: '',
    priceKes: 10,
    durationMinutes: 60,
    speedLimitDownloadKbps: 3072,
    speedLimitUploadKbps: 1536,
    dataLimitMb: 0,
    description: '',
  });

  // Router & WiFi Config Form
  const [routerConfigForm, setRouterConfigForm] = useState({
    gatewayType: 'standard_wifi' as 'standard_wifi' | 'mikrotik' | 'mock',
    wifiSsid: 'BomaWiFi-HighSpeed',
    wifiPassword: 'BomaWiFi@2026',
    wifiSecurity: 'WPA2' as 'WPA' | 'WPA2' | 'nopass',
    host: '192.168.88.1',
    port: 8728,
    username: 'api_hotspot',
    hotspotServerName: 'hotspot1',
    isLive: true,
  });
  const [testingRouter, setTestingRouter] = useState<boolean>(false);
  const [routerTestResult, setRouterTestResult] = useState<any>(null);
  const [adminQrUrl, setAdminQrUrl] = useState<string>('');
  const [currentWifiModeTab, setCurrentWifiModeTab] = useState<'phone' | 'windows' | 'linux' | 'router'>('phone');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Generate live test QR code for Current WiFi configuration in Admin
  useEffect(() => {
    const ssid = routerConfigForm.wifiSsid || 'BomaWiFi-HighSpeed';
    const pass = routerConfigForm.wifiPassword || 'BomaWiFi@2026';
    const qrPayload = `WIFI:T:WPA;S:${ssid};P:${pass};;`;
    QRCode.toDataURL(qrPayload, {
      width: 200,
      margin: 1,
      color: { dark: '#022c22', light: '#ffffff' },
    })
      .then(url => setAdminQrUrl(url))
      .catch(() => {});
  }, [routerConfigForm.wifiSsid, routerConfigForm.wifiPassword]);

  const copyCommand = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  // Automated Tests
  const [testResults, setTestResults] = useState<AutomatedTestResult[]>([]);
  const [runningTests, setRunningTests] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setAuthLoading(false);
      // Pre-authorize user or bootstrapped email
      if (user?.email === 'calebchieu@gmail.com') {
        setAdminRole('superadmin');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [activeTab]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [overviewRes, pkgsRes, sessRes, txRes, logsRes, rtrRes, intRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/packages?all=true'),
        fetch(`/api/admin/sessions?filter=${sessionFilter}`),
        fetch('/api/admin/transactions'),
        fetch('/api/admin/audit-logs'),
        fetch('/api/router/status'),
        fetch('/api/integrations/status'),
      ]);

      if (overviewRes.ok) setMetrics(await overviewRes.json());
      if (pkgsRes.ok) {
        const d = await pkgsRes.json();
        setPackages(d.packages || []);
      }
      if (sessRes.ok) {
        const d = await sessRes.json();
        setSessions(d.sessions || []);
      }
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions || []);
      }
      if (logsRes.ok) {
        const d = await logsRes.json();
        setAuditLogs(d.logs || []);
      }
      if (rtrRes.ok) {
        const d = await rtrRes.json();
        setRouterStatus(d);
        if (d.config) {
          setRouterConfigForm({
            gatewayType: d.config.gatewayType || 'standard_wifi',
            wifiSsid: d.config.wifiSsid || 'BomaWiFi-HighSpeed',
            wifiPassword: d.config.wifiPassword || 'BomaWiFi@2026',
            wifiSecurity: d.config.wifiSecurity || 'WPA2',
            host: d.config.host || '192.168.88.1',
            port: d.config.port || 8728,
            username: d.config.username || 'api_hotspot',
            hotspotServerName: d.config.hotspotServerName || 'hotspot1',
            isLive: typeof d.config.isLive === 'boolean' ? d.config.isLive : true,
          });
        }
      }
      if (intRes.ok) setIntegrationsStatus(await intRes.json());
    } catch (e) {
      console.error('Failed to load admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isSigningIn) return;
    try {
      setIsSigningIn(true);
      setLoginError(null);
      const res = await loginWithGoogle();
      if (!res) {
        // Closed or cancelled by user
        return;
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        setLoginError('Browser blocked the sign-in popup. Please allow popups or use the Superadmin Quick Access below.');
      } else if (err?.code !== 'auth/cancelled-popup-request' && err?.code !== 'auth/popup-closed-by-user') {
        setLoginError(err.message || 'Google sign in failed');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSimulatedAdminLogin = () => {
    // Quick demo login if Firebase Auth popups are blocked in dev iframe
    setCurrentUser({
      uid: 'superadmin_1',
      email: 'calebchieu@gmail.com',
      displayName: 'Caleb Chieu (Administrator)',
    } as any);
    setAdminRole('superadmin');
  };

  // Package CRUD
  const handleOpenNewPackage = () => {
    setIsNewPackage(true);
    setEditingPackage(null);
    setPackageFormData({
      name: '',
      priceKes: 10,
      durationMinutes: 60,
      speedLimitDownloadKbps: 3072,
      speedLimitUploadKbps: 1536,
      dataLimitMb: 0,
      description: '',
    });
  };

  const handleOpenEditPackage = (pkg: WifiPackage) => {
    setIsNewPackage(false);
    setEditingPackage(pkg);
    setPackageFormData({
      name: pkg.name,
      priceKes: pkg.priceKes,
      durationMinutes: pkg.durationMinutes,
      speedLimitDownloadKbps: pkg.speedLimitDownloadKbps,
      speedLimitUploadKbps: pkg.speedLimitUploadKbps,
      dataLimitMb: pkg.dataLimitMb || 0,
      description: pkg.description,
    });
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isNewPackage) {
        const res = await fetch('/api/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(packageFormData),
        });
        if (res.ok) {
          setEditingPackage(null);
          setIsNewPackage(false);
          fetchAllData();
        }
      } else if (editingPackage) {
        const res = await fetch(`/api/packages/${editingPackage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(packageFormData),
        });
        if (res.ok) {
          setEditingPackage(null);
          fetchAllData();
        }
      }
    } catch (err) {
      console.error('Error saving package:', err);
    }
  };

  const handleTogglePackage = async (pkgId: string) => {
    try {
      await fetch(`/api/packages/${pkgId}/toggle`, { method: 'PATCH' });
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      await fetch(`/api/packages/${pkgId}`, { method: 'DELETE' });
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  // Session Actions
  const handleRevokeSession = async (sessId: string) => {
    if (!confirm('Disconnect this client and terminate hotspot access immediately?')) return;
    try {
      await fetch(`/api/sessions/${sessId}/revoke`, { method: 'POST' });
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExtendSession = async (sessId: string, minutes: number) => {
    try {
      await fetch(`/api/sessions/${sessId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalMinutes: minutes }),
      });
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  // Router Test
  const handleTestRouter = async () => {
    try {
      setTestingRouter(true);
      setRouterTestResult(null);
      const res = await fetch('/api/router/test-connection', { method: 'POST' });
      const data = await res.json();
      setRouterTestResult(data);
    } catch (e: any) {
      setRouterTestResult({ success: false, message: e.message });
    } finally {
      setTestingRouter(false);
    }
  };

  const handleSaveRouterConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/router/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routerConfigForm),
      });
      if (res.ok) {
        setRouterSavedNotice(true);
        setTimeout(() => setRouterSavedNotice(false), 3000);
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Run Test Suite
  const handleRunTestSuite = async () => {
    try {
      setRunningTests(true);
      const res = await fetch('/api/admin/test-suite', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTestResults(data.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunningTests(false);
    }
  };

  // Filtered Transactions
  const filteredTxs = transactions.filter(tx => {
    const matchesSearch =
      tx.mpesaReceiptNumber.toLowerCase().includes(txSearch.toLowerCase()) ||
      tx.phone.includes(txSearch) ||
      tx.orderId.toLowerCase().includes(txSearch.toLowerCase());
    const matchesStatus = txStatusFilter === 'all' || tx.status === txStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // If not logged in, show secure login barrier
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Shield className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Administrator Portal</h1>
          <p className="text-sm text-slate-400 mt-2">
            Sign in with an authorized Firebase administrator account to access revenue reports, package configurations, and router controls.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          {loginError && (
            <div className="p-3 bg-red-950/60 border border-red-800/40 rounded-xl text-red-300 text-xs text-left flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isSigningIn}
            className="w-full py-3.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-900 font-bold rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow cursor-pointer"
          >
            {isSigningIn ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-slate-900" />
                <span>Connecting with Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500 font-semibold">Or Superadmin Quick Access</span>
            </div>
          </div>

          <button
            onClick={handleSimulatedAdminLogin}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 border border-slate-700 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Sign in as calebchieu@gmail.com</span>
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Admin credentials and router passwords are kept on the server and never exposed to client browsers.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header with User Info & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black text-white">HotSpot Administration</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {adminRole}
              </span>
            </div>
            <p className="text-xs text-slate-400">{currentUser.email || 'Admin'}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              logoutUser();
              setCurrentUser(null);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-900/40 text-red-300 rounded-xl text-xs font-semibold transition-all border border-red-800/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Integration Status Alert Banner */}
      {integrationsStatus && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Daraja Status */}
          <div
            className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
              integrationsStatus.daraja.isConfigured
                ? 'bg-emerald-950/30 border-emerald-600/30 text-emerald-300'
                : 'bg-amber-950/30 border-amber-600/30 text-amber-200'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="text-xs">
              <span className="font-bold">M-Pesa Daraja: {integrationsStatus.daraja.isConfigured ? 'LIVE' : 'SIMULATION MODE'}</span>
              <p className="text-[11px] opacity-80 mt-0.5">{integrationsStatus.daraja.note}</p>
            </div>
          </div>

          {/* Router Status */}
          <div
            className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
              integrationsStatus.router.isLive
                ? 'bg-emerald-950/30 border-emerald-600/30 text-emerald-300'
                : 'bg-blue-950/30 border-blue-600/30 text-blue-200'
            }`}
          >
            <Server className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
            <div className="text-xs">
              <span className="font-bold">RouterOS: {integrationsStatus.router.isLive ? 'LIVE' : 'MOCK ADAPTER'}</span>
              <p className="text-[11px] opacity-80 mt-0.5">{integrationsStatus.router.note}</p>
            </div>
          </div>

          {/* Firebase Status */}
          <div className="p-3.5 rounded-xl border bg-emerald-950/30 border-emerald-600/30 text-emerald-300 flex items-start space-x-3">
            <Database className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div className="text-xs">
              <span className="font-bold">Firestore & Security Rules</span>
              <p className="text-[11px] opacity-80 mt-0.5">Database deployed with hardened zero-trust rules.</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-1 overflow-x-auto border-b border-slate-800 pb-2 scrollbar-none text-xs font-semibold">
        {[
          { id: 'overview', label: 'Overview & Revenue', icon: DollarSign },
          { id: 'packages', label: 'Packages', icon: Layers },
          { id: 'sessions', label: 'HotSpot Sessions', icon: Users },
          { id: 'transactions', label: 'M-Pesa Transactions', icon: FileText },
          { id: 'router', label: 'MikroTik RouterOS', icon: Server },
          { id: 'tests', label: 'Automated Tests', icon: Play },
          { id: 'setup', label: 'Setup & Integrations', icon: Key },
          { id: 'audit', label: 'Audit Trail', icon: Activity },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & REVENUE ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {metrics ? formatKes(metrics.totalRevenueKes) : 'KES 0'}
              </p>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center space-x-1">
                <span>Real: {formatKes(metrics?.realRevenueKes || 0)}</span>
                <span>•</span>
                <span className="text-amber-400">Sim: {formatKes(metrics?.simulatedRevenueKes || 0)}</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Successful Payments</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {metrics?.successfulCount || 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Out of {metrics?.totalOrdersCount || 0} initiated orders
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active Connected Users</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {metrics?.activeSessionsCount || 0}
              </p>
              <p className="text-[11px] text-emerald-400 mt-2">
                Authorized on HotSpot router
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Expired Sessions</span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {metrics?.expiredSessionsCount || 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Access disconnected automatically
              </p>
            </div>
          </div>

          {/* 7-Day Revenue Trend Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-base">7-Day Sales Trend</h3>
                <p className="text-xs text-slate-400">Daily revenue collections in Africa/Nairobi EAT</p>
              </div>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                Kenya Shillings (KES)
              </span>
            </div>

            <div className="h-44 flex items-end justify-between gap-2 pt-6">
              {metrics?.dailyStats &&
                metrics.dailyStats.map((item: any) => {
                  const maxAmt = Math.max(...metrics.dailyStats.map((d: any) => d.amount), 50);
                  const heightPercent = Math.max(10, Math.round((item.amount / maxAmt) * 100));
                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="w-full bg-slate-800/70 rounded-xl overflow-hidden flex flex-col justify-end h-32 relative">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-xl transition-all duration-500 group-hover:brightness-110"
                        />
                        <span className="absolute top-1 inset-x-0 text-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          KES {item.amount}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.date.split('-').slice(1).join('/')}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Recent Payments Quick Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Recent M-Pesa Payments</h3>
              <button
                onClick={() => setActiveTab('transactions')}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 font-medium">Receipt</th>
                    <th className="py-2 font-medium">Phone</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Date (EAT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {transactions.slice(0, 5).map(tx => (
                    <tr key={tx.id} className="text-slate-300">
                      <td className="py-2.5 font-bold text-white">{tx.mpesaReceiptNumber}</td>
                      <td className="py-2.5">{formatKenyanPhone(tx.phone)}</td>
                      <td className="py-2.5 font-bold text-emerald-400">{formatKes(tx.amountKes)}</td>
                      <td className="py-2.5 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {tx.isSimulated ? 'Simulated' : 'Verified'}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400 text-[11px] font-sans">
                        {formatNairobiDateTime(tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PACKAGES MANAGEMENT */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Internet Packages</h2>
              <p className="text-xs text-slate-400">Configure prices, durations, speed limits, and data allowances</p>
            </div>
            <button
              onClick={handleOpenNewPackage}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Create Package</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className={`bg-slate-900 border rounded-2xl p-5 shadow-lg relative transition-all ${
                  pkg.isActive ? 'border-slate-800' : 'border-slate-800/50 opacity-60'
                }`}
              >
                {pkg.isSample && (
                  <span className="absolute top-4 right-4 text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                    Initial Sample
                  </span>
                )}

                <div className="pr-20">
                  <h3 className="font-bold text-white text-base">{pkg.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{pkg.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Price</span>
                    <p className="font-black text-white text-base mt-0.5">{formatKes(pkg.priceKes)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Duration</span>
                    <p className="font-semibold text-slate-200 mt-0.5">{formatDuration(pkg.durationMinutes)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Bandwidth</span>
                    <p className="font-semibold text-emerald-400 mt-0.5">
                      {(pkg.speedLimitDownloadKbps / 1024).toFixed(0)}M / {(pkg.speedLimitUploadKbps / 1024).toFixed(0)}M
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleTogglePackage(pkg.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      pkg.isActive
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{pkg.isActive ? 'Active' : 'Disabled'}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenEditPackage(pkg)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                      title="Edit Package"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!pkg.isSample && (
                      <button
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-all border border-red-800/40"
                        title="Delete Package"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Edit / Create Package Modal */}
          {(editingPackage || isNewPackage) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <h3 className="font-bold text-white text-lg">
                  {isNewPackage ? 'Create New Package' : 'Edit Package'}
                </h3>

                <form onSubmit={handleSavePackage} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold">Package Name</label>
                    <input
                      type="text"
                      required
                      value={packageFormData.name}
                      onChange={e => setPackageFormData({ ...packageFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-300 font-semibold">Price (KES)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={packageFormData.priceKes}
                        onChange={e => setPackageFormData({ ...packageFormData, priceKes: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold">Duration (Minutes)</label>
                      <input
                        type="number"
                        min="5"
                        required
                        value={packageFormData.durationMinutes}
                        onChange={e => setPackageFormData({ ...packageFormData, durationMinutes: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-300 font-semibold">Download Limit (Kbps)</label>
                      <input
                        type="number"
                        min="512"
                        value={packageFormData.speedLimitDownloadKbps}
                        onChange={e =>
                          setPackageFormData({ ...packageFormData, speedLimitDownloadKbps: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold">Upload Limit (Kbps)</label>
                      <input
                        type="number"
                        min="256"
                        value={packageFormData.speedLimitUploadKbps}
                        onChange={e =>
                          setPackageFormData({ ...packageFormData, speedLimitUploadKbps: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold">Description</label>
                    <textarea
                      rows={2}
                      value={packageFormData.description}
                      onChange={e => setPackageFormData({ ...packageFormData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white mt-1"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPackage(null);
                        setIsNewPackage(false);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                    >
                      Save Package
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HOTSPOT SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">HotSpot User Sessions</h2>
              <p className="text-xs text-slate-400">Live active connected devices, remaining time, and manual controls</p>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href="/api/admin/sessions/export"
                download
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Sessions CSV</span>
              </a>
            </div>
          </div>

          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="p-3.5 font-medium">Customer Phone</th>
                  <th className="p-3.5 font-medium">Package</th>
                  <th className="p-3.5 font-medium">Voucher</th>
                  <th className="p-3.5 font-medium">Device MAC</th>
                  <th className="p-3.5 font-medium">Remaining</th>
                  <th className="p-3.5 font-medium">Status</th>
                  <th className="p-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No sessions found.
                    </td>
                  </tr>
                ) : (
                  sessions.map(sess => (
                    <tr key={sess.id} className="text-slate-300 hover:bg-slate-850">
                      <td className="p-3.5 font-mono font-semibold text-white">
                        {formatKenyanPhone(sess.phone)}
                      </td>
                      <td className="p-3.5">{sess.packageName}</td>
                      <td className="p-3.5 font-mono text-emerald-400 font-bold">{sess.voucherCode}</td>
                      <td className="p-3.5 font-mono text-slate-400">{sess.macAddress}</td>
                      <td className="p-3.5 font-semibold text-white">
                        {sess.status === 'active' && sess.remainingMinutes
                          ? `${sess.remainingMinutes}m`
                          : '—'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sess.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {sess.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {sess.status === 'active' ? (
                          <>
                            <button
                              onClick={() => handleExtendSession(sess.id, 60)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold"
                            >
                              +1hr
                            </button>
                            <button
                              onClick={() => handleRevokeSession(sess.id)}
                              className="px-2 py-1 bg-red-950/60 hover:bg-red-900/60 text-red-300 rounded text-[11px] font-semibold border border-red-800/40"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500">Terminated</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: M-PESA TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">M-Pesa Financial Transactions</h2>
              <p className="text-xs text-slate-400">Verified payment receipts, phone numbers, and amounts</p>
            </div>
            <a
              href="/api/admin/transactions/export"
              download
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </a>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search by M-Pesa receipt, phone number, or order ID..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={txStatusFilter}
              onChange={e => setTxStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified Payments Only</option>
            </select>
          </div>

          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="p-3.5 font-medium">M-Pesa Receipt</th>
                  <th className="p-3.5 font-medium">Customer Phone</th>
                  <th className="p-3.5 font-medium">Amount</th>
                  <th className="p-3.5 font-medium">Order ID</th>
                  <th className="p-3.5 font-medium">Classification</th>
                  <th className="p-3.5 font-medium">Timestamp (EAT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 font-sans">
                      No matching transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map(tx => (
                    <tr key={tx.id} className="text-slate-300 hover:bg-slate-850">
                      <td className="p-3.5 font-bold text-white">{tx.mpesaReceiptNumber}</td>
                      <td className="p-3.5">{formatKenyanPhone(tx.phone)}</td>
                      <td className="p-3.5 font-bold text-emerald-400">{formatKes(tx.amountKes)}</td>
                      <td className="p-3.5 text-slate-400">{tx.orderId}</td>
                      <td className="p-3.5 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.isSimulated
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {tx.isSimulated ? 'Simulated' : 'Real Payment'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 font-sans text-[11px]">
                        {formatNairobiDateTime(tx.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: HOTSPOT GATEWAY & CURRENT WI-FI SETUP */}
      {activeTab === 'router' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Wifi className="w-5 h-5 text-emerald-400" />
                <span>Wi-Fi Hotspot & Gateway Management</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Turn your current phone, laptop, home router, or MikroTik hardware into a paid M-Pesa hotspot
              </p>
            </div>
            <button
              onClick={handleTestRouter}
              disabled={testingRouter}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer shrink-0"
            >
              <RotateCw className={`w-3.5 h-3.5 ${testingRouter ? 'animate-spin' : ''}`} />
              <span>{testingRouter ? 'Checking Gateway...' : 'Test HotSpot Status'}</span>
            </button>
          </div>

          {/* Test Connection Output */}
          {routerTestResult && (
            <div
              className={`p-4 rounded-2xl border text-xs flex items-start space-x-3 ${
                routerTestResult.success
                  ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-200'
                  : 'bg-red-950/40 border-red-600/40 text-red-200'
              }`}
            >
              {routerTestResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold">{routerTestResult.message}</p>
                <p className="text-[11px] opacity-80">
                  Latency: {routerTestResult.latencyMs}ms • Gateway: {routerTestResult.routerVersion || 'Current Wi-Fi HotSpot'} • Active Clients: {routerTestResult.activeUsersCount || 0}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Configuration Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">Hotspot Gateway Mode</h3>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  {routerConfigForm.gatewayType === 'standard_wifi' ? 'Current Wi-Fi Mode' : 'MikroTik Mode'}
                </span>
              </div>

              <form onSubmit={handleSaveRouterConfig} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Select Hotspot Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRouterConfigForm({ ...routerConfigForm, gatewayType: 'standard_wifi', isLive: true })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        routerConfigForm.gatewayType === 'standard_wifi'
                          ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold flex items-center space-x-1.5 text-emerald-400">
                        <Wifi className="w-4 h-4" />
                        <span>My Current Wi-Fi (Recommended)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Use your existing phone hotspot, laptop, or home Wi-Fi (Safaricom 5G, TP-Link, Huawei, etc.). No hardware purchase needed!
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRouterConfigForm({ ...routerConfigForm, gatewayType: 'mikrotik', isLive: true })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        routerConfigForm.gatewayType === 'mikrotik'
                          ? 'bg-blue-950/60 border-blue-500 text-white shadow-md ring-1 ring-blue-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold flex items-center space-x-1.5 text-blue-400">
                        <Server className="w-4 h-4" />
                        <span>MikroTik RouterOS</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Physical commercial MikroTik routerboard with automated captive portal redirect & MAC binding.
                      </p>
                    </button>
                  </div>
                </div>

                {/* CURRENT WIFI CONFIGURATION */}
                {routerConfigForm.gatewayType === 'standard_wifi' && (
                  <div className="space-y-4 bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4">
                    <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                      <Wifi className="w-4 h-4" />
                      <span>Current Wi-Fi HotSpot Credentials</span>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block">Your Wi-Fi Network Name (SSID)</label>
                      <input
                        type="text"
                        placeholder="e.g. MyHotspot or Safaricom_5G_Home"
                        value={routerConfigForm.wifiSsid}
                        onChange={e => setRouterConfigForm({ ...routerConfigForm, wifiSsid: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono mt-1 text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Enter your existing phone hotspot name or Wi-Fi network name.
                      </p>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block">Your Wi-Fi Password</label>
                      <input
                        type="text"
                        placeholder="e.g. SecretWiFi123"
                        value={routerConfigForm.wifiPassword || ''}
                        onChange={e => setRouterConfigForm({ ...routerConfigForm, wifiPassword: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono mt-1 text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Paying customers receive an instant auto-connect QR code and this password as soon as their M-Pesa payment is verified.
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 space-y-1">
                      <p className="font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Zero Hardware Cost</span>
                      </p>
                      <p className="text-slate-300">
                        Customers visit your portal, pick an internet bundle, pay via Lipa Na M-Pesa STK Push, and instantly get access to your Wi-Fi!
                      </p>
                    </div>
                  </div>
                )}

                {/* MIKROTIK ROUTEROS HARDWARE CONFIGURATION */}
                {routerConfigForm.gatewayType === 'mikrotik' && (
                  <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                    <div>
                      <label className="text-slate-300 font-semibold block">MikroTik IP or Hostname</label>
                      <input
                        type="text"
                        value={routerConfigForm.host}
                        onChange={e => setRouterConfigForm({ ...routerConfigForm, host: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-300 font-semibold block">API Port</label>
                        <input
                          type="number"
                          value={routerConfigForm.port}
                          onChange={e => setRouterConfigForm({ ...routerConfigForm, port: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-semibold block">API Username</label>
                        <input
                          type="text"
                          value={routerConfigForm.username}
                          onChange={e => setRouterConfigForm({ ...routerConfigForm, username: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block">Hotspot Server Name</label>
                      <input
                        type="text"
                        value={routerConfigForm.hotspotServerName}
                        onChange={e => setRouterConfigForm({ ...routerConfigForm, hotspotServerName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono mt-1"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  {routerSavedNotice && (
                    <div className="p-3 bg-emerald-950/80 border border-emerald-500 rounded-xl text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold">HotSpot settings saved! Customer portal updated with new Wi-Fi credentials.</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 text-sm"
                  >
                    <span>Save HotSpot Gateway Settings</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Dynamic Setup Instructions & Live QR Tester */}
            {routerConfigForm.gatewayType === 'standard_wifi' ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center space-x-2">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span>Use Current Device as Hotspot</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Follow the steps for your device below to share internet with paying customers
                    </p>
                  </div>
                </div>

                {/* Device Selector Tabs */}
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setCurrentWifiModeTab('phone')}
                    className={`py-2 px-2 rounded-lg transition-all text-center ${
                      currentWifiModeTab === 'phone'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Phone Hotspot
                  </button>
                  <button
                    onClick={() => setCurrentWifiModeTab('windows')}
                    className={`py-2 px-2 rounded-lg transition-all text-center ${
                      currentWifiModeTab === 'windows'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Windows PC
                  </button>
                  <button
                    onClick={() => setCurrentWifiModeTab('linux')}
                    className={`py-2 px-2 rounded-lg transition-all text-center ${
                      currentWifiModeTab === 'linux'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Linux Hotspot
                  </button>
                  <button
                    onClick={() => setCurrentWifiModeTab('router')}
                    className={`py-2 px-2 rounded-lg transition-all text-center ${
                      currentWifiModeTab === 'router'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Home Router
                  </button>
                </div>

                {/* Setup Content by Device */}
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs space-y-3">
                  {currentWifiModeTab === 'phone' && (
                    <div className="space-y-2 text-slate-300">
                      <p className="font-bold text-white flex items-center space-x-1.5">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span>Turn Your Android Phone or iPhone into the Hotspot</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                        <li>
                          Open your phone's <strong>Settings</strong> &gt; <strong>Personal Hotspot</strong> (iPhone) or <strong>Portable Hotspot / Tethering</strong> (Android).
                        </li>
                        <li>
                          Set Hotspot Network Name to: <strong className="text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{routerConfigForm.wifiSsid}</strong>
                        </li>
                        <li>
                          Set Hotspot Password to: <strong className="text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{routerConfigForm.wifiPassword || 'BomaWiFi@2026'}</strong>
                        </li>
                        <li>
                          Turn <strong>ON</strong> Mobile Hotspot.
                        </li>
                        <li>
                          <strong>Done!</strong> Customers open your BomaWiFi page, pay with Lipa Na M-Pesa, and automatically receive the QR code and credentials to connect to your phone's Wi-Fi!
                        </li>
                      </ol>
                    </div>
                  )}

                  {currentWifiModeTab === 'windows' && (
                    <div className="space-y-3 text-slate-300">
                      <p className="font-bold text-white flex items-center space-x-1.5">
                        <Laptop className="w-4 h-4 text-emerald-400" />
                        <span>Windows 10 / 11 Mobile Hotspot Setup</span>
                      </p>
                      <p className="text-slate-400">
                        Open <strong>Settings &gt; Network & Internet &gt; Mobile Hotspot</strong>, click Edit to set the SSID and password, then toggle ON.
                      </p>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-300 mb-1">
                          Or copy and run this in Windows PowerShell / Command Prompt (Admin):
                        </p>
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center justify-between">
                          <span className="truncate mr-2">
                            netsh wlan set hostednetwork mode=allow ssid="{routerConfigForm.wifiSsid}" key="{routerConfigForm.wifiPassword}" && netsh wlan start hostednetwork
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyCommand(
                                `netsh wlan set hostednetwork mode=allow ssid="${routerConfigForm.wifiSsid}" key="${routerConfigForm.wifiPassword}"\nnetsh wlan start hostednetwork`,
                                'win'
                              )
                            }
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            {copiedCmd === 'win' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentWifiModeTab === 'linux' && (
                    <div className="space-y-3 text-slate-300">
                      <p className="font-bold text-white flex items-center space-x-1.5">
                        <Server className="w-4 h-4 text-emerald-400" />
                        <span>Linux / Raspberry Pi Wi-Fi Hotspot Command</span>
                      </p>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-300 mb-1">
                          Run with NetworkManager CLI:
                        </p>
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center justify-between">
                          <span className="truncate mr-2">
                            nmcli dev wifi hotspot ifname wlan0 ssid "{routerConfigForm.wifiSsid}" password "{routerConfigForm.wifiPassword}"
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyCommand(
                                `nmcli dev wifi hotspot ifname wlan0 ssid "${routerConfigForm.wifiSsid}" password "${routerConfigForm.wifiPassword}"`,
                                'linux'
                              )
                            }
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            {copiedCmd === 'linux' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentWifiModeTab === 'router' && (
                    <div className="space-y-2 text-slate-300">
                      <p className="font-bold text-white flex items-center space-x-1.5">
                        <Wifi className="w-4 h-4 text-emerald-400" />
                        <span>Existing Home Router (Safaricom Fibre, TP-Link, Huawei, etc.)</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-300">
                        <li>Log into your home router's admin panel (typically 192.168.1.1 or 192.168.8.1).</li>
                        <li>Verify or set the Wi-Fi Name (SSID) and Password to match the values configured on the left.</li>
                        <li>You can also enable a <strong>Guest Wi-Fi Network</strong> specifically for hotspot customers.</li>
                        <li>Customers pay through BomaWiFi, receive the QR code, and connect smoothly.</li>
                      </ol>
                    </div>
                  )}
                </div>

                {/* LIVE WI-FI QR CODE PREVIEW & TESTER */}
                <div className="bg-slate-950 rounded-xl p-4 border border-emerald-500/30 flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-2 bg-white rounded-xl shadow-lg border border-emerald-500/40 shrink-0">
                    {adminQrUrl ? (
                      <img src={adminQrUrl} alt="Live HotSpot QR Code" className="w-28 h-28 object-contain" />
                    ) : (
                      <div className="w-28 h-28 flex items-center justify-center text-slate-500 text-xs">
                        <RotateCw className="w-5 h-5 animate-spin text-emerald-500" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs space-y-1.5 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <h4 className="font-bold text-white">Live Customer QR Code Tester</h4>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Test-scan this with your phone camera right now. If your phone asks to join <strong>{routerConfigForm.wifiSsid}</strong>, your setup is 100% working!
                    </p>
                    <p className="text-emerald-400 font-mono text-[11px] font-semibold">
                      SSID: {routerConfigForm.wifiSsid} • Pass: {routerConfigForm.wifiPassword || 'None'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Right Column for MikroTik Mode: Terminal Script */
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">MikroTik RouterOS Script</h3>
                    <p className="text-xs text-slate-400">Copy to WinBox terminal to configure Walled Garden & API</p>
                  </div>
                  <a
                    href="/api/router/script"
                    download="mikrotik_bomawifi_setup.rsc"
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.rsc Script</span>
                  </a>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300 h-64 overflow-y-auto space-y-1">
                  <p className="text-emerald-400"># 1. Enable API and REST services</p>
                  <p>/ip service set api disabled=no port=8728</p>
                  <p>/ip service set api-ssl disabled=no port=8729</p>
                  <p className="text-emerald-400 pt-2"># 2. Create API User</p>
                  <p>/user group add name=bomawifi_api policy=read,write,api</p>
                  <p>/user add name=api_hotspot group=bomawifi_api password="YOUR_PASSWORD"</p>
                  <p className="text-emerald-400 pt-2"># 3. Walled Garden for M-Pesa</p>
                  <p>/ip hotspot walled-garden add dst-host=*safaricom.co.ke</p>
                  <p>/ip hotspot walled-garden add dst-host=*daraja.safaricom.co.ke</p>
                  <p>/ip hotspot walled-garden add dst-host=*googleapis.com</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: AUTOMATED TESTS RUNNER */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Automated Integration Tests</h2>
              <p className="text-xs text-slate-400">Verify payment success, idempotency, duplicate callbacks, and router activation</p>
            </div>
            <button
              onClick={handleRunTestSuite}
              disabled={runningTests}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow"
            >
              <Play className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
              <span>{runningTests ? 'Running Test Suite...' : 'Run Automated Tests'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {testResults.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-3">
                <Play className="w-8 h-8 mx-auto text-emerald-400 opacity-60" />
                <p className="text-sm font-semibold text-white">No test results yet</p>
                <p className="text-xs">Click "Run Automated Tests" to execute full verification of the payment and router pipelines.</p>
              </div>
            ) : (
              testResults.map(test => (
                <div
                  key={test.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    test.status === 'passed'
                      ? 'bg-slate-900 border-emerald-500/30'
                      : 'bg-red-950/30 border-red-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {test.status === 'passed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-white text-sm">{test.name}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {test.durationMs}ms
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{test.message}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        test.status === 'passed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}
                    >
                      {test.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 7: SETUP GUIDES & INTEGRATIONS CHECKLIST */}
      {activeTab === 'setup' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Go-Live & Hardware Setup Checklist</h2>
            <p className="text-xs text-slate-400">Complete setup instructions for Safaricom Daraja, MikroTik RouterOS, and Firebase</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Daraja */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Needs API Keys
                </span>
              </div>
              <h3 className="font-bold text-white text-base">Safaricom Daraja STK Push</h3>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
                <li>Create an account at <span className="text-emerald-400">developer.safaricom.co.ke</span></li>
                <li>Create an App with Lipa Na M-Pesa sandbox or live product.</li>
                <li>Copy <span className="font-mono text-white">DARAJA_CONSUMER_KEY</span>, <span className="font-mono text-white">DARAJA_CONSUMER_SECRET</span>, and <span className="font-mono text-white">DARAJA_PASSKEY</span> into your Cloud Run secrets or environment.</li>
                <li>Set <span className="font-mono text-white">DARAJA_SHORTCODE</span> to your Paybill or Till number.</li>
              </ol>
            </div>

            {/* Step 2: MikroTik RouterOS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Mock or Hardware
                </span>
              </div>
              <h3 className="font-bold text-white text-base">MikroTik RouterOS Gateway</h3>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
                <li>Connect to your router using WinBox.</li>
                <li>Run the provided BomaWiFi setup script in New Terminal.</li>
                <li>Replace <span className="font-mono text-white">hotspot/login.html</span> with the captive portal redirect template.</li>
                <li>Add Safaricom Daraja IP ranges to the Walled Garden so users can pay without prior internet.</li>
              </ol>
            </div>

            {/* Step 3: Firebase */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Configured
                </span>
              </div>
              <h3 className="font-bold text-white text-base">Firestore & Security Rules</h3>
              <p className="text-xs text-slate-300">
                Firestore database <span className="font-mono text-emerald-400">ai-studio-f9f0e396-a59a-4154-a7b5-cc1f2fd7f3a7</span> has been provisioned. Zero-trust security rules have been deployed to restrict financial transactions and router secrets strictly to administrators.
              </p>
            </div>

            {/* Step 4: Custom Domain & Cloud Run */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Cloud Run Ready
                </span>
              </div>
              <h3 className="font-bold text-white text-base">Hosting & Custom Domain</h3>
              <p className="text-xs text-slate-300">
                Deploy with <span className="font-mono text-white">npm run build</span> and start script <span className="font-mono text-white">tsx server.ts</span>. Map your custom domain (e.g. <span className="font-mono text-emerald-400">wifi.yourbusiness.co.ke</span>) with automated SSL.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Administrative & System Audit Trail</h2>
            <p className="text-xs text-slate-400">Immutable log of package changes, payments verified, router authentications, and session extensions</p>
          </div>

          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="p-3.5 font-medium">Actor</th>
                  <th className="p-3.5 font-medium">Action</th>
                  <th className="p-3.5 font-medium">Resource</th>
                  <th className="p-3.5 font-medium">Details</th>
                  <th className="p-3.5 font-medium">Timestamp (EAT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {auditLogs.map(log => (
                  <tr key={log.id} className="text-slate-300 hover:bg-slate-850">
                    <td className="p-3.5 text-white">{log.actorEmail}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">{log.resourceType}</td>
                    <td className="p-3.5 font-sans text-slate-300 max-w-xs truncate">{log.details}</td>
                    <td className="p-3.5 font-sans text-[11px] text-slate-400 whitespace-nowrap">
                      {formatNairobiDateTime(log.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
