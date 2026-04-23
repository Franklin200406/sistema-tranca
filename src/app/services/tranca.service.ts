import { Injectable } from '@angular/core';
import { onValue, ref, set } from 'firebase/database';
import { DatabaseService } from './database.service';
import { LockStatus, TrancaState, UsuarioLogado } from '../core/models';

@Injectable({ providedIn: 'root' })
export class TrancaService {
  constructor(private readonly databaseService: DatabaseService) {}

  watchTranca(callback: (tranca: TrancaState) => void): (() => void) | null {
    const database = this.databaseService.getDatabase();
    if (!database) {
      return null;
    }

    return onValue(ref(database, 'tranca'), (snapshot) => {
      callback((snapshot.val() || {}) as TrancaState);
    });
  }

  async atualizarStatus(
    proximoStatus: LockStatus,
    acao: 'abrir' | 'travar',
    usuario: UsuarioLogado
  ): Promise<void> {
    const database = this.requireDatabase();

    await set(ref(database, 'tranca'), {
      status: proximoStatus,
      ultimaAtualizacao: {
        usuario_id: usuario.id,
        usuario_login: usuario.login || usuario.id,
        acao,
        data_hora: new Date().toISOString()
      }
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
