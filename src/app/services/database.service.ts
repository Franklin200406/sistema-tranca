import { Injectable } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { Database, getDatabase } from 'firebase/database';
import { firebaseConfig } from '../core/firebase.config';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly firebasePronto = Object.values(firebaseConfig).every(
    (value) => String(value || '').trim() !== ''
  );

  private readonly databaseInstance: Database | null = this.firebasePronto
    ? getDatabase(getApps().length ? getApp() : initializeApp(firebaseConfig))
    : null;

  isReady(): boolean {
    return this.firebasePronto;
  }

  getDatabase(): Database | null {
    return this.databaseInstance;
  }
}
