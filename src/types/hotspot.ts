/**
 * BomaWiFi Types & Interfaces
 * Africa/Nairobi Timezone & Kenyan Shilling (KES)
 */

export interface WifiPackage {
  id: string;
  name: string;
  priceKes: number;
  durationMinutes: number;
  speedLimitDownloadKbps: number;
  speedLimitUploadKbps: number;
  dataLimitMb?: number; // 0 or undefined = unlimited
  description: string;
  isActive: boolean;
  isSample: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type PaymentOrderStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface PaymentOrder {
  id: string;
  orderNumber: string;
  phone: string;
  amountKes: number;
  packageId: string;
  packageName: string;
  durationMinutes: number;
  status: PaymentOrderStatus;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  mpesaReceiptNumber?: string;
  customerMac?: string;
  customerIp?: string;
  isSimulated: boolean;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  mpesaReceiptNumber: string;
  amountKes: number;
  phone: string;
  transactionDate: string;
  status: 'verified' | 'reconciled';
  isSimulated: boolean;
  rawCallbackHash?: string;
  createdAt: string;
}

export interface Customer {
  id: string; // Phone number formatted e.g. 254712345678
  phone: string;
  totalSpentKes: number;
  totalSessionsCount: number;
  lastSeenAt: string;
  lastMacAddress?: string;
  createdAt: string;
}

export type HotspotSessionStatus = 'active' | 'expired' | 'revoked';

export interface HotspotSession {
  id: string;
  orderId: string;
  phone: string;
  macAddress: string;
  ipAddress: string;
  packageId: string;
  packageName: string;
  voucherCode: string;
  status: HotspotSessionStatus;
  startedAt: string;
  expiresAt: string;
  remainingMinutes?: number;
  totalBytesIn: number;
  totalBytesOut: number;
  routerUserId: string;
  isSimulated: boolean;
  wifiSsid?: string;
  wifiPassword?: string;
  gatewayType?: 'standard_wifi' | 'mikrotik' | 'mock';
  createdAt: string;
  updatedAt: string;
}

export type GatewayType = 'standard_wifi' | 'mikrotik' | 'mock';

export interface RouterConfiguration {
  id: string;
  name: string;
  gatewayType: GatewayType; // 'standard_wifi' = Use current home/office WiFi with QR & Password; 'mikrotik' = Hardware; 'mock' = Simulation
  wifiSsid: string;
  wifiPassword?: string;
  wifiSecurity?: 'WPA' | 'WPA2' | 'nopass';
  host: string;
  port: number;
  username: string;
  hotspotServerName: string;
  isLive: boolean; // false = mock mode, true = real gateway/router
  lastStatus: 'online' | 'offline' | 'unconfigured' | 'mock_mode';
  lastPingAt: string;
  pingLatencyMs?: number;
  totalActiveUsers: number;
  updatedAt: string;
}

export interface Administrator {
  id: string;
  email: string;
  role: 'superadmin' | 'admin' | 'staff';
  name: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorEmail: string;
  actorUid: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  timestamp: string;
}

export interface DarajaStkCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
}

export interface AutomatedTestResult {
  id: string;
  name: string;
  category: 'payment' | 'idempotency' | 'router' | 'expiry';
  status: 'passed' | 'failed' | 'running';
  message: string;
  details?: Record<string, any>;
  durationMs: number;
}
