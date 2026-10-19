/**
 * Real-time Firestore Database Synchronization Service
 * Stores Packages, Orders, Transactions, and Sessions directly in Firebase Firestore
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { WifiPackage, PaymentOrder, Transaction, HotspotSession } from '../types/hotspot';

/**
 * Saves a payment order to Firestore collection 'paymentOrders'
 */
export async function syncOrderToFirestore(order: PaymentOrder): Promise<void> {
  try {
    const ref = doc(db, 'paymentOrders', order.id);
    await setDoc(ref, {
      ...order,
      syncedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `paymentOrders/${order.id}`);
  }
}

/**
 * Saves a verified transaction to Firestore collection 'transactions'
 */
export async function syncTransactionToFirestore(tx: Transaction): Promise<void> {
  try {
    const ref = doc(db, 'transactions', tx.id);
    await setDoc(ref, {
      ...tx,
      syncedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `transactions/${tx.id}`);
  }
}

/**
 * Saves an active hotspot session to Firestore collection 'hotspotSessions'
 */
export async function syncSessionToFirestore(session: HotspotSession): Promise<void> {
  try {
    const ref = doc(db, 'hotspotSessions', session.id);
    await setDoc(ref, {
      ...session,
      syncedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `hotspotSessions/${session.id}`);
  }
}

/**
 * Saves package to Firestore
 */
export async function syncPackageToFirestore(pkg: WifiPackage): Promise<void> {
  try {
    const ref = doc(db, 'packages', pkg.id);
    await setDoc(ref, {
      ...pkg,
      syncedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `packages/${pkg.id}`);
  }
}
