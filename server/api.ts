/**
 * Express API Router for BomaWiFi Hotspot Management
 * Endpoints for Customer Captive Portal, M-Pesa Daraja, RouterOS, and Admin Dashboard
 */

import { Router, Request, Response } from 'express';
import { darajaService } from './daraja';
import { hotspotStore } from './store';
import { getRouterAdapter, generateRouterOsScript } from './routeros';
import { normalizeKenyanPhone } from '../src/utils/kenya';
import { PaymentOrder } from '../src/types/hotspot';

export const apiRouter = Router();

// ----------------------------------------------------
// Health & Integration Diagnostics
// ----------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    timezone: 'Africa/Nairobi (EAT)',
    currency: 'KES',
  });
});

apiRouter.get('/integrations/status', async (_req: Request, res: Response) => {
  const darajaConfigured = darajaService.isConfigured();
  const routerAdapter = getRouterAdapter(hotspotStore.getRouterConfig().isLive ? 'live' : 'mock');
  const routerTest = await routerAdapter.testConnection();

  res.json({
    daraja: {
      status: darajaConfigured ? 'live_configured' : 'simulation_mode',
      environment: darajaService.getEnvironment(),
      shortcode: darajaService.getShortcode(),
      isConfigured: darajaConfigured,
      note: darajaConfigured
        ? 'Connected to Safaricom Daraja API'
        : 'Running in safe simulation mode. Real STK Push requires DARAJA_CONSUMER_KEY and PASSKEY.',
    },
    router: {
      status: hotspotStore.getRouterConfig().isLive ? (routerTest.success ? 'online' : 'offline') : 'mock_mode',
      isLive: hotspotStore.getRouterConfig().isLive,
      host: hotspotStore.getRouterConfig().host,
      port: hotspotStore.getRouterConfig().port,
      latencyMs: routerTest.latencyMs,
      activeUsers: routerTest.activeUsersCount,
      version: routerTest.routerVersion,
      note: hotspotStore.getRouterConfig().isLive
        ? 'Connected to physical MikroTik RouterOS'
        : 'Running in Mock RouterOS mode. Simulates connected clients and bandwidth limits.',
    },
    firebase: {
      status: 'configured',
      projectId: 'gen-lang-client-0577867094',
      database: 'ai-studio-f9f0e396-a59a-4154-a7b5-cc1f2fd7f3a7',
      auth: 'Google Auth & RBAC',
    },
  });
});

// ----------------------------------------------------
// Packages (Customer & Admin)
// ----------------------------------------------------
apiRouter.get('/packages', (req: Request, res: Response) => {
  const onlyActive = req.query.all !== 'true';
  const packages = hotspotStore.getPackages(onlyActive);
  res.json({ packages });
});

apiRouter.post('/packages', (req: Request, res: Response) => {
  const { name, priceKes, durationMinutes, speedLimitDownloadKbps, speedLimitUploadKbps, dataLimitMb, description } = req.body;
  if (!name || !priceKes || !durationMinutes) {
    return res.status(400).json({ error: 'Name, price, and duration are required' });
  }

  const pkg = hotspotStore.createPackage({
    name: String(name),
    priceKes: Number(priceKes),
    durationMinutes: Number(durationMinutes),
    speedLimitDownloadKbps: Number(speedLimitDownloadKbps) || 3072,
    speedLimitUploadKbps: Number(speedLimitUploadKbps) || 1536,
    dataLimitMb: Number(dataLimitMb) || 0,
    description: String(description || ''),
    isActive: true,
    isSample: false,
    sortOrder: hotspotStore.getPackages().length + 1,
  });

  res.status(201).json({ success: true, package: pkg });
});

apiRouter.put('/packages/:id', (req: Request, res: Response) => {
  const updated = hotspotStore.updatePackage(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Package not found' });
  res.json({ success: true, package: updated });
});

apiRouter.patch('/packages/:id/toggle', (req: Request, res: Response) => {
  const updated = hotspotStore.togglePackageActive(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Package not found' });
  res.json({ success: true, package: updated });
});

apiRouter.delete('/packages/:id', (req: Request, res: Response) => {
  const ok = hotspotStore.deletePackage(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Package not found' });
  res.json({ success: true, message: 'Package deleted' });
});

// ----------------------------------------------------
// M-Pesa STK Push Initiation
// ----------------------------------------------------
apiRouter.post('/payments/stk-push', async (req: Request, res: Response) => {
  try {
    const { phone, packageId, customerMac, customerIp } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const phoneValidation = normalizeKenyanPhone(phone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ error: phoneValidation.error });
    }

    const pkg = hotspotStore.getPackage(packageId);
    if (!pkg || !pkg.isActive) {
      return res.status(400).json({ error: 'Selected WiFi package is not active or available' });
    }

    const orderId = `ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const orderNumber = `BW-${Date.now().toString().slice(-6)}`;

    // Call Daraja service (or simulation adapter)
    const stkRes = await darajaService.initiateStkPush({
      phone: phoneValidation.normalized,
      amount: pkg.priceKes,
      orderNumber,
      accountReference: 'BomaWiFi',
      transactionDesc: pkg.name.substring(0, 13),
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60000); // 15 mins expiry for order

    const order: PaymentOrder = {
      id: orderId,
      orderNumber,
      phone: phoneValidation.normalized,
      amountKes: pkg.priceKes,
      packageId: pkg.id,
      packageName: pkg.name,
      durationMinutes: pkg.durationMinutes,
      status: stkRes.success ? 'pending' : 'failed',
      merchantRequestId: stkRes.merchantRequestId,
      checkoutRequestId: stkRes.checkoutRequestId,
      customerMac: customerMac || req.ip || '',
      customerIp: customerIp || req.ip || '',
      isSimulated: stkRes.isSimulated,
      failureReason: stkRes.error,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    hotspotStore.createPaymentOrder(order);

    hotspotStore.addAuditLog({
      actorEmail: phoneValidation.normalized,
      actorUid: 'customer_portal',
      action: 'STK_PUSH_INITIATED',
      resourceType: 'order',
      resourceId: orderId,
      details: `${stkRes.isSimulated ? '[SIMULATED] ' : ''}STK Push initiated for ${phoneValidation.normalized} (KES ${pkg.priceKes}, ${pkg.name})`,
    });

    res.json({
      success: stkRes.success,
      orderId,
      orderNumber,
      isSimulated: stkRes.isSimulated,
      checkoutRequestId: stkRes.checkoutRequestId,
      customerMessage: stkRes.customerMessage,
      phone: phoneValidation.normalized,
      carrier: phoneValidation.carrier,
      amountKes: pkg.priceKes,
      packageName: pkg.name,
      durationMinutes: pkg.durationMinutes,
    });
  } catch (err: any) {
    console.error('STK Push endpoint error:', err);
    res.status(500).json({ error: err.message || 'Server error initiating payment' });
  }
});

// ----------------------------------------------------
// Public Daraja Webhook Callback Endpoint
// ----------------------------------------------------
apiRouter.post('/payments/daraja-callback', async (req: Request, res: Response) => {
  try {
    const callbackData = darajaService.parseCallback(req.body);

    if (!callbackData.isValid) {
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback format' });
    }

    const order = hotspotStore.findOrderByCheckoutRequestId(callbackData.checkoutRequestId);

    if (!order) {
      console.warn(`Order not found for CheckoutRequestID: ${callbackData.checkoutRequestId}`);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted but order not found' });
    }

    if (!callbackData.isSuccessful) {
      hotspotStore.updatePaymentOrder(order.id, {
        status: callbackData.resultCode === 1032 ? 'cancelled' : 'failed',
        failureReason: callbackData.resultDesc,
      });

      hotspotStore.addAuditLog({
        actorEmail: 'daraja_webhook',
        actorUid: 'safaricom',
        action: 'STK_PUSH_FAILED',
        resourceType: 'order',
        resourceId: order.id,
        details: `Payment failed for ${order.phone}: ${callbackData.resultDesc} (Code: ${callbackData.resultCode})`,
      });

      return res.json({ ResultCode: 0, ResultDesc: 'Failure recorded' });
    }

    // Successful payment callback -> verify and activate
    const receipt = callbackData.mpesaReceiptNumber || `SIM_REC_${Date.now()}`;
    const amount = callbackData.amount || order.amountKes;

    const activation = await hotspotStore.verifyAndActivatePayment({
      orderId: order.id,
      mpesaReceiptNumber: receipt,
      amountKes: amount,
      phone: callbackData.phone || order.phone,
      isSimulated: order.isSimulated,
    });

    res.json({
      ResultCode: 0,
      ResultDesc: activation.success ? 'Payment verified and internet session activated' : 'Payment recorded',
    });
  } catch (err: any) {
    console.error('Daraja callback handling error:', err);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal server error processing callback' });
  }
});

// ----------------------------------------------------
// Payment Status Polling Endpoint
// ----------------------------------------------------
apiRouter.get('/payments/order-status/:orderId', async (req: Request, res: Response) => {
  const order = hotspotStore.getPaymentOrder(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Active query to Safaricom Daraja if order is pending with a live CheckoutRequestID
  if (
    order.status === 'pending' &&
    order.checkoutRequestId &&
    !order.checkoutRequestId.includes('_SIM_') &&
    darajaService.isConfigured()
  ) {
    try {
      const queryRes = await darajaService.queryStkStatus(order.checkoutRequestId);
      if (queryRes.success && queryRes.isProcessed) {
        if (queryRes.resultCode === 0) {
          // Customer successfully entered PIN and paid!
          const receipt = `MPESA_${Date.now().toString().slice(-8)}`;
          await hotspotStore.verifyAndActivatePayment({
            orderId: order.id,
            mpesaReceiptNumber: receipt,
            amountKes: order.amountKes,
            phone: order.phone,
            isSimulated: false,
          });
        } else if (queryRes.resultCode === 1032) {
          hotspotStore.updatePaymentOrder(order.id, {
            status: 'cancelled',
            failureReason: queryRes.resultDesc || 'Payment was cancelled on device',
          });
        } else if (queryRes.resultCode === 1037) {
          hotspotStore.updatePaymentOrder(order.id, {
            status: 'failed',
            failureReason: queryRes.resultDesc || 'M-Pesa STK Push prompt timed out',
          });
        }
      }
    } catch (e) {
      console.warn('Daraja status query error:', e);
    }
  }

  // Check if session exists
  let session = undefined;
  if (order.status === 'completed') {
    session = hotspotStore.getSessionByOrderId(order.id) || hotspotStore.checkSession(order.phone).session;
  }

  res.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
    phone: order.phone,
    amountKes: order.amountKes,
    packageName: order.packageName,
    durationMinutes: order.durationMinutes,
    status: order.status,
    isSimulated: order.isSimulated,
    mpesaReceiptNumber: order.mpesaReceiptNumber,
    failureReason: order.failureReason,
    createdAt: order.createdAt,
    session,
  });
});

// ----------------------------------------------------
// Development / Testing Simulator Trigger
// ----------------------------------------------------
apiRouter.post('/payments/simulate-prompt', async (req: Request, res: Response) => {
  const { orderId, action } = req.body; // action: 'approve' | 'cancel' | 'timeout'
  const order = hotspotStore.getPaymentOrder(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.status === 'completed') {
    const existingSession = hotspotStore.getSessionByOrderId(order.id) || hotspotStore.checkSession(order.phone).session;
    return res.json({ success: true, message: 'Order already completed', status: 'completed', session: existingSession });
  }

  if (action === 'cancel') {
    hotspotStore.updatePaymentOrder(orderId, {
      status: 'cancelled',
      failureReason: 'The user cancelled the M-Pesa PIN prompt request (Simulated ResultCode: 1032)',
    });
    return res.json({ success: true, status: 'cancelled', message: 'Payment cancelled by user' });
  }

  if (action === 'timeout') {
    hotspotStore.updatePaymentOrder(orderId, {
      status: 'failed',
      failureReason: 'Transaction timed out. User did not respond in time (Simulated ResultCode: 1037)',
    });
    return res.json({ success: true, status: 'failed', message: 'Payment timed out' });
  }

  // Approve simulation
  const receipt = `SIM_${Date.now().toString().slice(-8)}`;
  const activation = await hotspotStore.verifyAndActivatePayment({
    orderId: order.id,
    mpesaReceiptNumber: receipt,
    amountKes: order.amountKes,
    phone: order.phone,
    isSimulated: true,
  });

  res.json({
    success: activation.success,
    status: 'completed',
    receipt,
    session: activation.session,
    message: 'Simulated payment approved! Router internet access activated.',
  });
});

// ----------------------------------------------------
// Session Management & Reconnection
// ----------------------------------------------------
apiRouter.post('/sessions/check', (req: Request, res: Response) => {
  const { identifier } = req.body; // phone, MAC, or voucher code
  const result = hotspotStore.checkSession(identifier);
  res.json(result);
});

apiRouter.post('/sessions/:id/revoke', (req: Request, res: Response) => {
  const ok = hotspotStore.revokeSession(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Session not found' });
  res.json({ success: true, message: 'Session revoked and user disconnected' });
});

apiRouter.post('/sessions/:id/extend', (req: Request, res: Response) => {
  const minutes = Number(req.body.additionalMinutes) || 60;
  const session = hotspotStore.extendSession(req.params.id, minutes);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ success: true, session });
});

// ----------------------------------------------------
// Admin Overview, Reports, & Exports
// ----------------------------------------------------
apiRouter.get('/admin/overview', (_req: Request, res: Response) => {
  const metrics = hotspotStore.getOverviewMetrics();
  res.json(metrics);
});

apiRouter.get('/admin/transactions', (_req: Request, res: Response) => {
  const transactions = hotspotStore.getTransactions();
  res.json({ transactions });
});

apiRouter.get('/admin/sessions', (req: Request, res: Response) => {
  const filter = req.query.filter as 'all' | 'active' | 'expired';
  const sessions = hotspotStore.getSessions(filter);
  res.json({ sessions });
});

apiRouter.get('/admin/customers', (_req: Request, res: Response) => {
  const customers = hotspotStore.getCustomers();
  res.json({ customers });
});

apiRouter.get('/admin/audit-logs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const logs = hotspotStore.getAuditLogs(limit);
  res.json({ logs });
});

// CSV Export: Transactions
apiRouter.get('/admin/transactions/export', (_req: Request, res: Response) => {
  const txs = hotspotStore.getTransactions();
  const headers = ['Transaction ID', 'M-Pesa Receipt', 'Phone', 'Amount (KES)', 'Status', 'Is Simulated', 'Date (EAT)'];
  const rows = txs.map(t => [
    t.id,
    t.mpesaReceiptNumber,
    t.phone,
    t.amountKes,
    t.status,
    t.isSimulated ? 'YES (Simulated)' : 'NO (Real)',
    t.createdAt,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bomawifi_transactions.csv"');
  res.send(csv);
});

// CSV Export: Sessions
apiRouter.get('/admin/sessions/export', (_req: Request, res: Response) => {
  const sessions = hotspotStore.getSessions();
  const headers = ['Session ID', 'Phone', 'Package', 'Voucher Code', 'MAC Address', 'Status', 'Started At', 'Expires At'];
  const rows = sessions.map(s => [
    s.id,
    s.phone,
    `"${s.packageName}"`,
    s.voucherCode,
    s.macAddress,
    s.status,
    s.startedAt,
    s.expiresAt,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bomawifi_sessions.csv"');
  res.send(csv);
});

// ----------------------------------------------------
// Router Management & Hardware Setup
// ----------------------------------------------------
apiRouter.get('/router/status', async (_req: Request, res: Response) => {
  const cfg = hotspotStore.getRouterConfig();
  const adapter = getRouterAdapter(cfg);
  const test = await adapter.testConnection();

  res.json({
    config: cfg,
    test,
  });
});

apiRouter.post('/router/test-connection', async (_req: Request, res: Response) => {
  const cfg = hotspotStore.getRouterConfig();
  const adapter = getRouterAdapter(cfg);
  const test = await adapter.testConnection();
  res.json(test);
});

apiRouter.post('/router/config', (req: Request, res: Response) => {
  const { host, port, username, hotspotServerName, isLive, gatewayType, wifiSsid, wifiPassword, wifiSecurity } = req.body;
  const updated = hotspotStore.updateRouterConfig({
    ...(host ? { host } : {}),
    ...(port ? { port: Number(port) } : {}),
    ...(username ? { username } : {}),
    ...(hotspotServerName ? { hotspotServerName } : {}),
    ...(gatewayType ? { gatewayType } : {}),
    ...(wifiSsid ? { wifiSsid } : {}),
    ...(typeof wifiPassword === 'string' ? { wifiPassword } : {}),
    ...(wifiSecurity ? { wifiSecurity } : {}),
    ...(typeof isLive === 'boolean' ? { isLive, lastStatus: isLive ? 'online' : 'mock_mode' } : {}),
  });
  res.json({ success: true, config: updated });
});

apiRouter.get('/router/script', (_req: Request, res: Response) => {
  const appUrl = process.env.APP_URL || 'https://bomawifi.co.ke';
  const script = generateRouterOsScript(appUrl, hotspotStore.getRouterConfig().hotspotServerName);
  res.setHeader('Content-Type', 'text/plain');
  res.send(script);
});

// ----------------------------------------------------
// Automated Test Suite Runner
// ----------------------------------------------------
apiRouter.post('/admin/test-suite', async (_req: Request, res: Response) => {
  const results = await hotspotStore.runAutomatedTestSuite();
  res.json({
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    results,
  });
});
