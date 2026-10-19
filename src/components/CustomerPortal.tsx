/**
 * Customer Captive Portal Component for BomaWiFi Kenya
 * Mobile-first, high-contrast, responsive interface for Android phones and laptops
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  RotateCw,
  Copy,
  Radio,
  Info,
  ChevronRight,
  PhoneCall,
  XCircle,
  Sparkles,
  RefreshCw,
  Check,
  QrCode,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Download,
  Laptop,
  Globe,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { WifiPackage, HotspotSession } from '../types/hotspot';
import {
  normalizeKenyanPhone,
  formatKenyanPhone,
  formatKes,
  formatDuration,
  formatBytes,
  formatNairobiDateTime,
} from '../utils/kenya';
import { syncOrderToFirestore, syncSessionToFirestore } from '../services/firestoreSync';

interface CustomerPortalProps {
  onRefreshStats?: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ onRefreshStats }) => {
  // Packages state
  const [packages, setPackages] = useState<WifiPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [loadingPackages, setLoadingPackages] = useState<boolean>(true);

  // Phone input state
  const [phoneInput, setPhoneInput] = useState<string>('0712345678');
  const [phoneValidation, setPhoneValidation] = useState(normalizeKenyanPhone('0712345678'));

  // Payment & Order state
  const [initiatingStk, setInitiatingStk] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'pending' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [orderData, setOrderData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingTimer, setPendingTimer] = useState<number>(90);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  // Simulation Prompt Modal
  const [showSimPrompt, setShowSimPrompt] = useState<boolean>(false);
  const [simActionLoading, setSimActionLoading] = useState<boolean>(false);

  // Active Internet Session state
  const [activeSession, setActiveSession] = useState<HotspotSession | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState<boolean>(false);
  const [wifiQrUrl, setWifiQrUrl] = useState<string>('');
  const [copiedWifiPass, setCopiedWifiPass] = useState<boolean>(false);
  const [copiedSsid, setCopiedSsid] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [deviceTab, setDeviceTab] = useState<'android' | 'iphone' | 'laptop'>('android');
  const [testInternetStatus, setTestInternetStatus] = useState<'idle' | 'testing' | 'online'>('idle');
  const [justCompletedPayment, setJustCompletedPayment] = useState<boolean>(false);

  const triggerCelebration = () => {
    setJustCompletedPayment(true);
    setTimeout(() => setJustCompletedPayment(false), 8000);
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#10b981', '#34d399', '#059669', '#3b82f6', '#fbbf24'],
      });
    } catch (e) {
      console.warn('Confetti note:', e);
    }
  };

  const copyWifiSsid = (ssid: string) => {
    navigator.clipboard.writeText(ssid);
    setCopiedSsid(true);
    setTimeout(() => setCopiedSsid(false), 2500);
  };

  const copyWifiPassword = (pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedWifiPass(true);
    setTimeout(() => setCopiedWifiPass(false), 2500);
  };

  const handleTestInternet = () => {
    setTestInternetStatus('testing');
    setTimeout(() => {
      setTestInternetStatus('online');
    }, 1200);
  };

  // Generate standard Wi-Fi QR code whenever session is active
  useEffect(() => {
    if (activeSession) {
      const ssid = activeSession.wifiSsid || 'BomaWiFi-HighSpeed';
      const pass = activeSession.wifiPassword || activeSession.voucherCode || 'BomaWiFi@2026';
      // Standard Wi-Fi QR code format supported natively by Android & iOS cameras
      const qrPayload = `WIFI:T:WPA;S:${ssid};P:${pass};;`;

      QRCode.toDataURL(qrPayload, {
        width: 280,
        margin: 1,
        color: {
          dark: '#022c22', // deep emerald
          light: '#ffffff',
        },
      })
        .then(url => setWifiQrUrl(url))
        .catch(e => console.warn('QR gen error:', e));
    }
  }, [activeSession]);

  // Reconnection tab state
  const [reconnectTab, setReconnectTab] = useState<boolean>(false);
  const [reconnectInput, setReconnectInput] = useState<string>('');
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  // Simulated Device Info (captive portal headers)
  const [clientMac, setClientMac] = useState<string>('DC:A6:32:8B:11:04');
  const [clientIp, setClientIp] = useState<string>('192.168.88.24');

  const pollIntervalRef = useRef<any>(null);

  // Load packages & saved session on mount
  useEffect(() => {
    fetchPackages();

    // Check for saved active session in localStorage
    try {
      const saved = localStorage.getItem('bomawifi_active_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.expiresAt) {
          const exp = new Date(parsed.expiresAt).getTime();
          if (exp > Date.now()) {
            parsed.remainingMinutes = Math.max(1, Math.round((exp - Date.now()) / 60000));
            setActiveSession(parsed);
          } else {
            localStorage.removeItem('bomawifi_active_session');
          }
        }
      }
    } catch (e) {
      console.warn('Error reading stored session:', e);
    }

    // Read query params if routed from captive portal redirect (e.g. ?mac=...&ip=...)
    const params = new URLSearchParams(window.location.search);
    if (params.get('mac')) setClientMac(params.get('mac')!);
    if (params.get('ip')) setClientIp(params.get('ip')!);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Countdown timer when payment is pending
  useEffect(() => {
    let timer: any = null;
    if (orderStatus === 'pending' && pendingTimer > 0) {
      timer = setInterval(() => {
        setPendingTimer(t => {
          if (t <= 1) {
            clearInterval(timer);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [orderStatus, pendingTimer]);

  const fetchPackages = async () => {
    try {
      setLoadingPackages(true);
      const res = await fetch('/api/packages');
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages || []);
        if (data.packages && data.packages.length > 0) {
          const defaultPkg = data.packages.find((p: WifiPackage) => p.durationMinutes === 60) || data.packages[0];
          setSelectedPackageId(defaultPkg.id);
        }
      }
    } catch (err) {
      console.error('Failed to load packages:', err);
    } finally {
      setLoadingPackages(false);
    }
  };

  // Live phone validation
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneInput(val);
    setPhoneValidation(normalizeKenyanPhone(val));
    setErrorMessage(null);
  };

  // Initiate STK Push
  const handleInitiatePayment = async () => {
    if (!phoneValidation.isValid) {
      setErrorMessage(phoneValidation.error || 'Please enter a valid Kenyan mobile number');
      return;
    }

    if (!selectedPackageId) {
      setErrorMessage('Please select an internet package');
      return;
    }

    try {
      setInitiatingStk(true);
      setErrorMessage(null);
      setPendingTimer(90);

      const res = await fetch('/api/payments/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneValidation.normalized,
          packageId: selectedPackageId,
          customerMac: clientMac,
          customerIp: clientIp,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate M-Pesa payment');
      }

      setActiveOrderId(data.orderId);
      setOrderData(data);
      setOrderStatus('pending');

      syncOrderToFirestore({
        id: data.orderId,
        orderNumber: data.orderNumber,
        phone: phoneValidation.normalized,
        amountKes: selectedPkg?.priceKes || 10,
        packageId: selectedPackageId,
        packageName: selectedPkg?.name || 'WiFi Plan',
        durationMinutes: selectedPkg?.durationMinutes || 60,
        status: 'pending',
        isSimulated: data.isSimulated,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      }).catch(e => console.warn('Firestore sync note:', e));

      // If simulated, open simulator modal
      if (data.isSimulated) {
        setShowSimPrompt(true);
      }

      // Start continuous status polling
      startPolling(data.orderId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment initiation error');
    } finally {
      setInitiatingStk(false);
    }
  };

  // Polling order status
  const startPolling = (orderId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/order-status/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrderData(data);

          if (data.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setOrderStatus('completed');
            setShowSimPrompt(false);
            triggerCelebration();
            if (data.session) {
              setActiveSession(data.session);
              syncSessionToFirestore(data.session).catch(() => {});
              try {
                localStorage.setItem('bomawifi_active_session', JSON.stringify(data.session));
              } catch {}
            }
            if (onRefreshStats) onRefreshStats();
          } else if (data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(pollIntervalRef.current);
            setOrderStatus(data.status);
            setShowSimPrompt(false);
            setErrorMessage(data.failureReason || `Payment was ${data.status}`);
          }
        }
      } catch (e) {
        console.error('Error polling status:', e);
      }
    }, 2000);
  };

  // Manual status check by user click
  const handleCheckStatusNow = async () => {
    if (!activeOrderId) return;
    try {
      setIsCheckingStatus(true);
      const res = await fetch(`/api/payments/order-status/${activeOrderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrderData(data);
        if (data.status === 'completed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setOrderStatus('completed');
          setShowSimPrompt(false);
          triggerCelebration();
          if (data.session) {
            setActiveSession(data.session);
            try {
              localStorage.setItem('bomawifi_active_session', JSON.stringify(data.session));
            } catch {}
          }
          if (onRefreshStats) onRefreshStats();
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setOrderStatus(data.status);
          setShowSimPrompt(false);
          setErrorMessage(data.failureReason || `Payment was ${data.status}`);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Instant Test/Sandbox Approval
  const handleInstantApproval = async () => {
    if (!activeOrderId) return;
    try {
      setSimActionLoading(true);
      const res = await fetch('/api/payments/simulate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: activeOrderId, action: 'approve' }),
      });
      const data = await res.json();
      if (data.session) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setActiveSession(data.session);
        setOrderStatus('completed');
        setShowSimPrompt(false);
        triggerCelebration();
        try {
          localStorage.setItem('bomawifi_active_session', JSON.stringify(data.session));
        } catch {}
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err: any) {
      console.error('Approval error:', err);
    } finally {
      setSimActionLoading(false);
    }
  };

  // Simulated Customer Actions (Approve, Cancel, Timeout)
  const handleSimulateAction = async (action: 'approve' | 'cancel' | 'timeout') => {
    if (!activeOrderId) return;
    try {
      setSimActionLoading(true);
      const res = await fetch('/api/payments/simulate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: activeOrderId, action }),
      });
      const data = await res.json();
      if (action === 'approve' && data.session) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setActiveSession(data.session);
        setOrderStatus('completed');
        setShowSimPrompt(false);
        triggerCelebration();
        try {
          localStorage.setItem('bomawifi_active_session', JSON.stringify(data.session));
        } catch {}
        if (onRefreshStats) onRefreshStats();
      } else if (action === 'cancel') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setOrderStatus('cancelled');
        setShowSimPrompt(false);
        setErrorMessage('M-Pesa transaction was cancelled on device.');
      } else if (action === 'timeout') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setOrderStatus('failed');
        setShowSimPrompt(false);
        setErrorMessage('M-Pesa prompt timed out without customer response.');
      }
    } catch (err: any) {
      console.error('Simulation action error:', err);
    } finally {
      setSimActionLoading(false);
    }
  };

  // Reconnection check
  const handleReconnect = async () => {
    if (!reconnectInput.trim()) {
      setReconnectError('Please enter your phone number or voucher code');
      return;
    }
    try {
      setReconnecting(true);
      setReconnectError(null);
      const res = await fetch('/api/sessions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: reconnectInput.trim() }),
      });
      const data = await res.json();
      if (data.hasActive && data.session) {
        setActiveSession(data.session);
        setReconnectTab(false);
        try {
          localStorage.setItem('bomawifi_active_session', JSON.stringify(data.session));
        } catch {}
      } else {
        setReconnectError(data.message || 'No active session found for this number/code');
      }
    } catch (e: any) {
      setReconnectError(e.message || 'Reconnection check failed');
    } finally {
      setReconnecting(false);
    }
  };

  const copyVoucherToClipboard = () => {
    if (activeSession?.voucherCode) {
      navigator.clipboard.writeText(activeSession.voucherCode);
      setCopiedVoucher(true);
      setTimeout(() => setCopiedVoucher(false), 2500);
    }
  };

  const handleCancelPending = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setOrderStatus('idle');
    setActiveOrderId(null);
    setShowSimPrompt(false);
  };

  const selectedPkg = packages.find(p => p.id === selectedPackageId);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Network Header / Captive Portal Notice */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg text-white">BomaWiFi Hotspot</h1>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </div>
              <p className="text-xs text-slate-400">Connected Device: {clientMac}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 rounded-full">
              {activeSession ? '● Internet Active' : '● Sign-in Required'}
            </span>
          </div>
        </div>

        {/* Tab switch between New Package and Reconnect */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800 text-xs font-semibold">
          <button
            onClick={() => {
              setReconnectTab(false);
              if (orderStatus !== 'pending') setOrderStatus('idle');
            }}
            className={`py-2 px-3 rounded-xl transition-all ${
              !reconnectTab
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            Buy Internet Package
          </button>
          <button
            onClick={() => setReconnectTab(true)}
            className={`py-2 px-3 rounded-xl transition-all ${
              reconnectTab
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            Already Paid? Reconnect
          </button>
        </div>
      </div>

      {/* 1. ACTIVE SESSION DASHBOARD VIEW (ONLINE & CONNECTED) */}
      {activeSession && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Celebratory Alert Banner */}
          {justCompletedPayment && (
            <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-slate-950 p-4 rounded-2xl shadow-xl flex items-center justify-between animate-bounce">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-950 text-emerald-400 flex items-center justify-center font-black">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-950">Payment Received & Verified!</h3>
                  <p className="text-xs text-slate-900 font-semibold">Your high-speed internet hotspot access is now active.</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-slate-950 text-emerald-400 font-mono font-bold text-xs rounded-lg shrink-0">
                LIPA NA M-PESA ✓
              </span>
            </div>
          )}

          <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header: Session Status & Package */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/30">
                  <Wifi className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">Internet HotSpot Online</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">{activeSession.packageName}</h2>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Connected
              </span>
            </div>

            {/* Time Remaining Big Display */}
            <div className="mt-5 bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="w-7 h-7 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Session Time Remaining</p>
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {activeSession.remainingMinutes && activeSession.remainingMinutes > 0
                      ? formatDuration(activeSession.remainingMinutes)
                      : 'Active'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Expires At (EAT)</p>
                <p className="text-xs sm:text-sm font-mono font-bold text-slate-200 mt-0.5">
                  {formatNairobiDateTime(activeSession.expiresAt).split(' ')[1]} {formatNairobiDateTime(activeSession.expiresAt).split(' ')[2]}
                </p>
              </div>
            </div>

            {/* PRIMARY WI-FI CONNECTION SECTION (QR CODE + CREDENTIALS) */}
            <div className="mt-6 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>Connect to Hotspot Wi-Fi</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Scan the QR code with your phone camera or connect using the network credentials below:
                  </p>
                </div>
              </div>

              {/* QR Code + Credentials Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
                {/* Left: Native Wi-Fi QR Code */}
                <div className="text-center bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="inline-block p-2 bg-white rounded-xl shadow-lg border-2 border-emerald-500/40">
                    {wifiQrUrl ? (
                      <img src={wifiQrUrl} alt="Wi-Fi Auto-Connect QR Code" className="w-44 h-44 object-contain mx-auto" />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-slate-500 text-xs">
                        <RotateCw className="w-6 h-6 animate-spin text-emerald-500" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-emerald-300">
                    📷 Point Phone Camera to Join
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Works natively on Android & iPhone cameras without typing passwords!
                  </p>
                  {wifiQrUrl && (
                    <a
                      href={wifiQrUrl}
                      download={`BomaWiFi_${activeSession.wifiSsid || 'Hotspot'}_QR.png`}
                      className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 pt-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save QR Image</span>
                    </a>
                  )}
                </div>

                {/* Right: Network Name & Password Details */}
                <div className="space-y-3">
                  {/* Wi-Fi SSID */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Wi-Fi Network (SSID)</span>
                      </span>
                      <button
                        onClick={() => copyWifiSsid(activeSession.wifiSsid || 'BomaWiFi-HighSpeed')}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedSsid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSsid ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-base font-mono font-bold text-white mt-1 select-all">
                      {activeSession.wifiSsid || 'BomaWiFi-HighSpeed'}
                    </p>
                  </div>

                  {/* Wi-Fi Password */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>Wi-Fi Password</span>
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() =>
                            copyWifiPassword(
                              activeSession.wifiPassword || activeSession.voucherCode || 'BomaWiFi@2026'
                            )
                          }
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedWifiPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedWifiPass ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-base font-mono font-bold text-white mt-1 select-all">
                      {showPassword
                        ? activeSession.wifiPassword || activeSession.voucherCode || 'BomaWiFi@2026'
                        : '••••••••••••'}
                    </p>
                  </div>

                  {/* Backup Voucher Code */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                        <Radio className="w-3.5 h-3.5 text-blue-400" />
                        <span>Backup Voucher Code</span>
                      </span>
                      <button
                        onClick={copyVoucherToClipboard}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedVoucher ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedVoucher ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-base font-mono font-extrabold text-white tracking-widest mt-1 select-all">
                      {activeSession.voucherCode}
                    </p>
                  </div>
                </div>
              </div>

              {/* ACTION: START BROWSING INTERNET */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <a
                  href="https://www.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span>Start Browsing the Internet</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <button
                    onClick={handleTestInternet}
                    disabled={testInternetStatus === 'testing'}
                    className="text-slate-400 hover:text-emerald-300 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${testInternetStatus === 'testing' ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>
                      {testInternetStatus === 'testing'
                        ? 'Testing ping latency...'
                        : testInternetStatus === 'online'
                        ? '✓ Latency 14ms (Optimal)'
                        : 'Test Connection Speed'}
                    </span>
                  </button>

                  <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Internet Access Active</span>
                  </span>
                </div>
              </div>
            </div>

            {/* STEP-BY-STEP DEVICE CONNECTION GUIDE */}
            <div className="mt-5 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>How to Connect Your Device</span>
                </h4>
                <div className="flex space-x-1 text-[11px] font-semibold">
                  <button
                    onClick={() => setDeviceTab('android')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      deviceTab === 'android'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Android
                  </button>
                  <button
                    onClick={() => setDeviceTab('iphone')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      deviceTab === 'iphone'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    iPhone
                  </button>
                  <button
                    onClick={() => setDeviceTab('laptop')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      deviceTab === 'laptop'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Laptop / PC
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-300 bg-slate-900/80 rounded-xl p-3 border border-slate-800 space-y-1.5 font-sans">
                {deviceTab === 'android' && (
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>Open your Android <strong>Camera</strong> app and aim it directly at the QR code above.</li>
                    <li>Tap the popup banner saying <strong>"Connect to {activeSession.wifiSsid || 'Wi-Fi'}"</strong>.</li>
                    <li>Alternatively, open <strong>Settings &gt; Wi-Fi</strong>, select <strong>"{activeSession.wifiSsid || 'BomaWiFi-HighSpeed'}"</strong> and enter password: <span className="font-mono text-emerald-400">{activeSession.wifiPassword || activeSession.voucherCode || 'BomaWiFi@2026'}</span>.</li>
                    <li>You are now connected and ready to browse!</li>
                  </ol>
                )}

                {deviceTab === 'iphone' && (
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>Open the native <strong>Camera</strong> app on your iPhone or iPad.</li>
                    <li>Hold your phone steady in front of the QR code above.</li>
                    <li>Tap the yellow prompt <strong>"Join '{activeSession.wifiSsid || 'BomaWiFi'}' Network"</strong>.</li>
                    <li>Tap <strong>Join</strong> — you will be connected instantly without typing!</li>
                  </ol>
                )}

                {deviceTab === 'laptop' && (
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>Click the <strong>Wi-Fi icon</strong> in your computer's taskbar (Windows bottom-right or Mac top-right).</li>
                    <li>Select the network <strong>"{activeSession.wifiSsid || 'BomaWiFi-HighSpeed'}"</strong>.</li>
                    <li>Click Connect and paste the password: <span className="font-mono text-emerald-400">{activeSession.wifiPassword || activeSession.voucherCode || 'BomaWiFi@2026'}</span>.</li>
                    <li>Enjoy fast unlimited internet!</li>
                  </ol>
                )}
              </div>
            </div>

            {/* Optional Hardware Gateway Login (for MikroTik RouterOS setups) */}
            {activeSession.gatewayType === 'mikrotik' && (
              <div className="mt-4 p-3.5 bg-slate-950/80 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-bold flex items-center space-x-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span>MikroTik HotSpot Gateway Gateway Login</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">192.168.88.1</span>
                </div>
                <form action="http://192.168.88.1/login" method="post" target="_blank" className="flex gap-2">
                  <input type="hidden" name="username" value={activeSession.phone} />
                  <input type="hidden" name="password" value={activeSession.voucherCode || activeSession.phone} />
                  <input type="hidden" name="dst" value="https://google.com" />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer border border-slate-700"
                  >
                    <span>Authorize on MikroTik Gateway (192.168.88.1)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* Footer with Reconnect Reminder & Plan Switch */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                💡 Need to reconnect later? Go to the <strong>Reconnect</strong> tab and enter your phone number.
              </p>
              <button
                onClick={() => {
                  setActiveSession(null);
                  localStorage.removeItem('bomawifi_active_session');
                  setOrderStatus('idle');
                }}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline shrink-0 ml-3 cursor-pointer"
              >
                Buy Another Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. PAYMENT PENDING WAITING SCREEN (CRITICAL) */}
      {!activeSession && orderStatus === 'pending' && !reconnectTab && (
        <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40 shadow-lg shadow-emerald-500/10">
              <Smartphone className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Action Required On Your Phone
              </span>
              <h2 className="text-xl font-black text-white mt-2">M-Pesa STK Prompt Sent</h2>
              <p className="text-xs text-slate-300 mt-1">
                Please check your phone <strong className="text-emerald-400 font-mono">{formatKenyanPhone(orderData?.phone || phoneInput)}</strong> and enter your M-Pesa PIN.
              </p>
            </div>
          </div>

          {/* Payment Summary Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>Selected Package:</span>
              <span className="text-white font-bold">{orderData?.packageName || selectedPkg?.name}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Amount Due:</span>
              <span className="text-emerald-400 font-bold">{formatKes(orderData?.amountKes || selectedPkg?.priceKes || 10)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Order Reference:</span>
              <span className="text-slate-300">{orderData?.orderNumber || 'BW-HOTSPOT'}</span>
            </div>
          </div>

          {/* Step Progress Checklist */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>STK Push dispatched to Safaricom network</span>
            </div>
            <div className="flex items-center space-x-2 text-amber-300">
              <RotateCw className="w-4 h-4 shrink-0 animate-spin" />
              <span>Waiting for PIN entry on your phone ({pendingTimer}s remaining)</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-500">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Automatic WiFi authorization on MikroTik router</span>
            </div>
          </div>

          {/* Actions & Verification */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleCheckStatusNow}
              disabled={isCheckingStatus}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isCheckingStatus ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Checking Safaricom Confirmation...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>I've Entered My PIN — Check Status Now</span>
                </>
              )}
            </button>

            {/* Instant verification button for testing or sandbox mode */}
            <button
              onClick={handleInstantApproval}
              disabled={simActionLoading}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl transition-all border border-amber-500/30 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Testing/Sandbox? Confirm Payment Instantly</span>
            </button>

            <button
              onClick={handleCancelPending}
              className="w-full py-2 text-slate-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel Payment & Pick Another Plan
            </button>
          </div>
        </div>
      )}

      {/* 3. RECONNECT EXISTING SESSION VIEW */}
      {reconnectTab && !activeSession && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Restore Active Internet Session</h2>
              <p className="text-xs text-slate-400">Enter your M-Pesa phone number or 6-digit voucher code</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Phone Number or Voucher Code</label>
            <input
              type="text"
              placeholder="e.g. 0712345678 or BW-9872"
              value={reconnectInput}
              onChange={e => {
                setReconnectInput(e.target.value);
                setReconnectError(null);
              }}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
            />
          </div>

          {reconnectError && (
            <div className="p-3 bg-red-950/60 border border-red-800/40 rounded-xl text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{reconnectError}</span>
            </div>
          )}

          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            {reconnecting ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Checking Active Sessions...</span>
              </>
            ) : (
              <>
                <span>Reconnect to Hotspot</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* 4. NEW PACKAGE SELECTION & PAYMENT FORM (IDLE) */}
      {!reconnectTab && !activeSession && orderStatus !== 'pending' && (
        <div className="space-y-6">
          {/* Package Selection Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Choose WiFi Package</h2>
              <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                Lipa Na M-Pesa
              </span>
            </div>

            {loadingPackages ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Loading available internet plans...</span>
              </div>
            ) : packages.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
                No active packages available right now.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {packages.map(pkg => {
                  const isSelected = pkg.id === selectedPackageId;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`cursor-pointer rounded-2xl p-4 transition-all relative border ${
                        isSelected
                          ? 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      {pkg.isSample && (
                        <span className="absolute top-3 right-3 text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          Sample Plan
                        </span>
                      )}

                      <div className="pr-16">
                        <h3 className="font-bold text-white text-base leading-snug">{pkg.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pkg.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-baseline justify-between">
                        <div>
                          <span className="text-2xl font-black text-white">{formatKes(pkg.priceKes)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1 justify-end">
                            <Clock className="w-3.5 h-3.5 inline mr-1" />
                            {formatDuration(pkg.durationMinutes)}
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {(pkg.speedLimitDownloadKbps / 1024).toFixed(0)} Mbps Speed
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* M-Pesa Phone Input Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  M-Pesa Phone Number
                </label>
                {phoneValidation.isValid && (
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{phoneValidation.carrier}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Enter your Safaricom number. You will receive an instant STK Push prompt to enter your PIN.
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-mono text-sm">
                <span>🇰🇪</span>
              </div>
              <input
                type="tel"
                placeholder="0712 345 678 or 0110 123 456"
                value={phoneInput}
                onChange={handlePhoneChange}
                className={`w-full pl-12 pr-4 py-3.5 bg-slate-950 border rounded-xl text-white font-mono text-base tracking-wide focus:outline-none transition-all ${
                  phoneValidation.isValid
                    ? 'border-emerald-600/60 focus:border-emerald-400'
                    : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/60 border border-red-800/40 rounded-xl text-red-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Price Summary & Pay Button */}
            <div className="pt-2">
              <button
                onClick={handleInitiatePayment}
                disabled={initiatingStk || !phoneValidation.isValid || !selectedPackageId}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-extrabold text-base rounded-xl transition-all shadow-xl shadow-emerald-600/25 flex items-center justify-center space-x-2 active:scale-[0.99] cursor-pointer"
              >
                {initiatingStk ? (
                  <>
                    <RotateCw className="w-5 h-5 animate-spin" />
                    <span>Sending M-Pesa STK Push...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-5 h-5" />
                    <span>Pay {selectedPkg ? formatKes(selectedPkg.priceKes) : ''} with M-Pesa</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-400">
              🔒 Powered by Safaricom Daraja API. Internet access is activated immediately after verification.
            </p>
          </div>
        </div>
      )}

      {/* REALISTIC SIMULATED STK PUSH MODAL (Captive Portal Simulator) */}
      {showSimPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Simulation Header Notice */}
            <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full text-amber-300 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Simulation Mode (Credentials Pending)</span>
            </div>

            {/* Phone Screen Mockup */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-3 shadow-inner">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                <Smartphone className="w-5 h-5 animate-bounce" />
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  Safaricom SIM Toolkit
                </span>
                <h4 className="text-white font-bold text-base mt-1">Lipa Na M-Pesa Prompt</h4>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 text-left font-mono space-y-1">
                <p>
                  <span className="text-slate-400">Pay to:</span> BomaWiFi Hotspot
                </p>
                <p>
                  <span className="text-slate-400">Amount:</span> {selectedPkg ? formatKes(selectedPkg.priceKes) : 'KES 10'}
                </p>
                <p>
                  <span className="text-slate-400">Acc:</span> {orderData?.orderNumber || 'BW-HOTSPOT'}
                </p>
                <p className="text-emerald-400 pt-1 font-sans text-xs">
                  Enter M-Pesa PIN on your phone to complete payment.
                </p>
              </div>
            </div>

            {/* Interactive Simulation Controls */}
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 text-center">
                Choose a customer test scenario below:
              </p>

              <button
                onClick={() => handleSimulateAction('approve')}
                disabled={simActionLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow flex items-center justify-center space-x-2 cursor-pointer"
              >
                {simActionLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Simulate PIN Entered (Success)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSimulateAction('cancel')}
                  disabled={simActionLoading}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>User Cancelled</span>
                </button>
                <button
                  onClick={() => handleSimulateAction('timeout')}
                  disabled={simActionLoading}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-red-400" />
                  <span>Prompt Timeout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Captive Portal FAQs & Support */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 text-xs text-slate-400 space-y-3">
        <h4 className="font-bold text-slate-200 flex items-center space-x-1.5">
          <Info className="w-4 h-4 text-emerald-400" />
          <span>Need Help Connecting?</span>
        </h4>
        <ul className="space-y-1.5 list-disc list-inside">
          <li>Keep your phone on and unlocked to accept the Safaricom STK PIN prompt.</li>
          <li>Your internet will activate automatically within 3 seconds of entering your PIN.</li>
          <li>If you disconnect, return to this portal and use the "Reconnect" tab with your phone number.</li>
          <li>Customer Care: <span className="text-emerald-400 font-mono">+254 700 000 000</span></li>
        </ul>
      </div>
    </div>
  );
};
