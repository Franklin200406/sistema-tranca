import { Injectable } from '@angular/core';
import { onValue, push, ref, set } from 'firebase/database';
import { DatabaseService } from './database.service';
import { LogEntry } from '../core/models';

@Injectable({ providedIn: 'root' })
export class LogsService {
  constructor(private readonly databaseService: DatabaseService) {}

  watchLogs(callback: (logs: Record<string, Omit<LogEntry, 'id'>>) => void): (() => void) | null {
    const database = this.databaseService.getDatabase();
    if (!database) {
      return null;
    }

    return onValue(ref(database, 'logs'), (snapshot) => {
      callback((snapshot.val() || {}) as Record<string, Omit<LogEntry, 'id'>>);
    });
  }

  async registrarLog(usuarioId: string, acao: string, resultado: string): Promise<void> {
    const database = this.requireDatabase();
    const novoLogRef = push(ref(database, 'logs'));

    await set(novoLogRef, {
      usuario_id: usuarioId,
      acao,
      resultado,
      data_hora: new Date().toISOString()
    });
  }

  private requireDatabase() {
    const database = this.databaseService.getDatabase();
    if (!database) {
      throw new Error('Firebase indisponivel.');
    }
    return database;
  }
}
