import { Injectable } from '@angular/core';
import { DataSnapshot, get, onValue, ref, set, push, update } from 'firebase/database';
import { DatabaseService } from './database.service';
import { RegisterPayload, Usuario } from '../core/models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUsuarios(): Promise<Record<string, Usuario>> {
    const database = this.requireDatabase();
    const snapshot = await get(ref(database, 'usuarios'));
    return (snapshot.val() || {}) as Record<string, Usuario>;
  }

  watchUsuarios(callback: (snapshot: DataSnapshot) => void): (() => void) | null {
    const database = this.databaseService.getDatabase();
    if (!database) {
      return null;
    }

    return onValue(ref(database, 'usuarios'), callback);
  }

  async createUsuario(payload: RegisterPayload): Promise<void> {
    const database = this.requireDatabase();
    const novoUsuarioRef = push(ref(database, 'usuarios'));

    await set(novoUsuarioRef, {
      nome: payload.nome,
      login: payload.login,
      senha_hash: payload.senha,
      ativo: true,
      nivel: 'usuario',
      pode_destrancar: false
    });
  }

  async migrateSenhaParaHash(userId: string, senhaHash: string): Promise<void> {
    const database = this.requireDatabase();
    await update(ref(database, `usuarios/${userId}`), {
      senha_hash: senhaHash,
      senha: null
    });
  }

  async updatePermissao(userId: string, permitir: boolean): Promise<void> {
    const database = this.requireDatabase();
    await set(ref(database, `usuarios/${userId}/pode_destrancar`), permitir);
  }

  private requireDatabase() {
    const database = this.databaseService.getDatabase();
    if (!database) {
      throw new Error('Firebase indisponivel.');
    }
    return database;
  }
}
