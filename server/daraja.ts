/**
 * Safaricom Daraja M-Pesa STK Push Integration Service
 * Compliant with Safaricom Daraja 2.0 API specifications
 * Features:
 * - Real Daraja STK Push (Sandbox & Production)
 * - Safe simulated test mode when credentials are not configured
 * - Strict separation: isSimulated flag prevents simulated payments from being marked as real
 * - Idempotent callback processing
 */

import { DarajaStkCallbackBody } from '../src/types/hotspot';

export interface DarajaConfig {
  environment: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
}

export interface StkPushRequestOptions {
  phone: string; // 2547XXXXXXXX or 2541XXXXXXXX
  amount: number;
  orderNumber: string;
  accountReference: string; // e.g. "BomaWiFi"
  transactionDesc: string; // e.g. "WiFi 1 Hour"
}

export interface StkPushResult {
  success: boolean;
  isSimulated: boolean;
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
  error?: string;
}

export class DarajaService {
  private config: DarajaConfig;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor() {
    this.config = {
      environment: (process.env.DARAJA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      consumerKey: process.env.DARAJA_CONSUMER_KEY || '',
      consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
      passkey: process.env.DARAJA_PASSKEY || '',
      shortcode: process.env.DARAJA_SHORTCODE || '174379',
      callbackUrl: process.env.DARAJA_CALLBACK_URL || '',
    };
  }

  /**
   * Checks if live credentials have been configured
   */
  public isConfigured(): boolean {
    return Boolean(
      this.config.consumerKey &&
      this.config.consumerSecret &&
      this.config.passkey &&
      this.config.shortcode &&
      this.config.consumerKey !== 'your_daraja_consumer_key_here'
    );
  }

  public getEnvironment(): 'sandbox' | 'production' {
    return this.config.environment;
  }

  public getShortcode(): string {
    return this.config.shortcode;
  }

  private getBaseUrl(): string {
    return this.config.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Generates timestamp in format YYYYMMDDHHmmss for Kenya (EAT)
   */
  private generateTimestamp(): string {
    const now = new Date();
    // Offset for UTC+3 (Africa/Nairobi)
    const nairobiTime = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = nairobiTime.getFullYear();
    const month = pad(nairobiTime.getMonth() + 1);
    const day = pad(nairobiTime.getDate());
    const hours = pad(nairobiTime.getHours());
    const minutes = pad(nairobiTime.getMinutes());
    const seconds = pad(nairobiTime.getSeconds());
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generates Daraja STK Push Password (Base64 of Shortcode + Passkey + Timestamp)
   */
  private generatePassword(timestamp: string): string {
    const raw = `${this.config.shortcode}${this.config.passkey}${timestamp}`;
    return Buffer.from(raw).toString('base64');
  }

  /**
   * Fetches Daraja OAuth Bearer token
   */
  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const authHeader = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64');

    const url = `${this.getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Daraja OAuth failed (${response.status}): ${errText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: string };
    const expiresInSec = parseInt(data.expires_in, 10) || 3599;
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (expiresInSec - 60) * 1000,
    };

    return data.access_token;
  }

  /**
   * Initiates STK Push
   * If credentials are not configured, runs in simulated mode explicitly
   */
  public async initiateStkPush(opts: StkPushRequestOptions): Promise<StkPushResult> {
    // If not configured, fall back to safe explicit simulation
    if (!this.isConfigured()) {
      const mockCheckoutId = `ws_CO_${Date.now()}_SIM_${Math.floor(100000 + Math.random() * 900000)}`;
      const mockMerchantId = `MKT_REQ_${Date.now()}`;
      return {
        success: true,
        isSimulated: true,
        merchantRequestId: mockMerchantId,
        checkoutRequestId: mockCheckoutId,
        responseCode: '0',
        responseDescription: 'Success. Request accepted for processing [SIMULATION MODE: Daraja credentials pending]',
        customerMessage: `A simulated M-Pesa prompt was sent to ${opts.phone}. Please complete payment in the prompt dialog.`,
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      const callbackUrl = this.config.callbackUrl || `${process.env.APP_URL || ''}/api/payments/daraja-callback`;

      const payload = {
        BusinessShortCode: this.config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // or CustomerBuyGoodsOnline for Till
        Amount: Math.round(opts.amount),
        PartyA: opts.phone,
        PartyB: this.config.shortcode,
        PhoneNumber: opts.phone,
        CallBackURL: callbackUrl,
        AccountReference: opts.accountReference.substring(0, 12),
        TransactionDesc: opts.transactionDesc.substring(0, 13),
      };

      const url = `${this.getBaseUrl()}/mpesa/stkpush/v1/processrequest`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as any;

      if (!response.ok || data.ResponseCode !== '0') {
        return {
          success: false,
          isSimulated: false,
          merchantRequestId: data.MerchantRequestID || '',
          checkoutRequestId: data.CheckoutRequestID || '',
          responseCode: data.ResponseCode || '1',
          responseDescription: data.ResponseDescription || 'STK Push failed',
          customerMessage: data.CustomerMessage || 'Failed to initiate M-Pesa STK Push.',
          error: data.errorMessage || data.ResponseDescription,
        };
      }

      return {
        success: true,
        isSimulated: false,
        merchantRequestId: data.MerchantRequestID,
        checkoutRequestId: data.CheckoutRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage,
      };
    } catch (err: any) {
      console.error('Error initiating Daraja STK Push:', err);
      return {
        success: false,
        isSimulated: false,
        merchantRequestId: '',
        checkoutRequestId: '',
        responseCode: '500',
        responseDescription: 'Daraja Network/Authentication Error',
        customerMessage: 'Could not contact Safaricom servers. Please check credentials or try again.',
        error: err.message,
      };
    }
  }

  /**
   * Queries Safaricom Daraja for the status of an STK Push transaction
   * Directly checks Safaricom servers to verify if customer entered PIN
   */
  public async queryStkStatus(checkoutRequestId: string): Promise<{
    success: boolean;
    isProcessed: boolean;
    resultCode?: number;
    resultDesc?: string;
    errorMessage?: string;
  }> {
    if (!this.isConfigured() || checkoutRequestId.includes('_SIM_')) {
      return { success: false, isProcessed: false, errorMessage: 'Running in simulation mode' };
    }

    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      const url = `${this.getBaseUrl()}/mpesa/stkpushquery/v1/query`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: this.config.shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        return {
          success: false,
          isProcessed: false,
          errorMessage: data.errorMessage || data.ResponseDescription || 'Failed to query status',
        };
      }

      const resultCode = typeof data.ResultCode !== 'undefined' ? parseInt(data.ResultCode, 10) : undefined;
      return {
        success: true,
        isProcessed: resultCode !== undefined,
        resultCode,
        resultDesc: data.ResultDesc || data.ResponseDescription,
      };
    } catch (err: any) {
      return {
        success: false,
        isProcessed: false,
        errorMessage: err.message,
      };
    }
  }

  /**
   * Parses and validates incoming Daraja STK callback
   */
  public parseCallback(body: DarajaStkCallbackBody): {
    isValid: boolean;
    isSuccessful: boolean;
    merchantRequestId: string;
    checkoutRequestId: string;
    resultCode: number;
    resultDesc: string;
    mpesaReceiptNumber?: string;
    amount?: number;
    phone?: string;
    transactionDate?: string;
  } {
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return {
        isValid: false,
        isSuccessful: false,
        merchantRequestId: '',
        checkoutRequestId: '',
        resultCode: -1,
        resultDesc: 'Invalid payload structure: missing Body.stkCallback',
      };
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    const isSuccessful = ResultCode === 0;

    let mpesaReceiptNumber: string | undefined;
    let amount: number | undefined;
    let phone: string | undefined;
    let transactionDate: string | undefined;

    if (isSuccessful && CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = String(item.Value);
        if (item.Name === 'Amount') amount = Number(item.Value);
        if (item.Name === 'PhoneNumber') phone = String(item.Value);
        if (item.Name === 'TransactionDate') transactionDate = String(item.Value);
      }
    }

    return {
      isValid: true,
      isSuccessful,
      merchantRequestId: MerchantRequestID,
      checkoutRequestId: CheckoutRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      mpesaReceiptNumber,
      amount,
      phone,
      transactionDate,
    };
  }
}

export const darajaService = new DarajaService();
