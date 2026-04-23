import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    const normalized = password.normalize('NFKC');
    const data = new TextEncoder().encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((value) => value.toString(16).padStart(2, '0')).join('');
  }

  async matches(password: string, senhaHash?: string): Promise<boolean> {
    if (!senhaHash) {
      return false;
    }

    const calculatedHash = await this.hashPassword(password);
    return calculatedHash === senhaHash;
  }
}
