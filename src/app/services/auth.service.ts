import { Injectable } from '@angular/core';
import { LoginPayload, RegisterPayload, Usuario, UsuarioLogado } from '../core/models';
import { PasswordService } from './password.service';
import { UsersService } from './users.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService
  ) {}

  async autenticar(payload: LoginPayload): Promise<{
    usuarioLogado: UsuarioLogado;
    usuarios: Record<string, Usuario>;
  }> {
    const usuarios = await this.usersService.getUsuarios();
    const loginNormalizado = payload.login.trim();
    const senhaNormalizada = payload.senha.trim();

    let usuarioEncontrado: [string, Usuario] | undefined;

    for (const entry of Object.entries(usuarios)) {
      const [, usuario] = entry;
      if (usuario?.login !== loginNormalizado) {
        continue;
      }

      const senhaConferePorHash = await this.passwordService.matches(
        senhaNormalizada,
        usuario?.senha_hash
      );
      const senhaConfereLegado = usuario?.senha === senhaNormalizada;

      if (senhaConferePorHash || senhaConfereLegado) {
        usuarioEncontrado = entry;

        if (senhaConfereLegado && !senhaConferePorHash) {
          const senhaHash = await this.passwordService.hashPassword(senhaNormalizada);
          await this.usersService.migrateSenhaParaHash(entry[0], senhaHash);
          usuario.senha_hash = senhaHash;
          delete usuario.senha;
        }
        break;
      }
    }

    if (!usuarioEncontrado) {
      throw new Error('Login ou senha invalidos.');
    }

    const [userId, usuario] = usuarioEncontrado;

    if (!usuario?.ativo) {
      throw new Error('Usuario encontrado, mas esta inativo.');
    }

    return {
      usuarioLogado: { id: userId, ...usuario },
      usuarios
    };
  }

  async cadastrar(payload: RegisterPayload): Promise<void> {
    const normalizado: RegisterPayload = {
      nome: payload.nome.trim(),
      login: payload.login.trim(),
      senha: payload.senha.trim()
    };

    if (!normalizado.nome || !normalizado.login || !normalizado.senha) {
      throw new Error('Preencha nome, login e senha.');
    }

    const usuarios = await this.usersService.getUsuarios();
    const loginExistente = Object.values(usuarios).some((usuario) => {
      return String(usuario?.login || '').toLowerCase() === normalizado.login.toLowerCase();
    });

    if (loginExistente) {
      throw new Error('Este login ja esta em uso. Escolha outro.');
    }

    const senhaHash = await this.passwordService.hashPassword(normalizado.senha);
    await this.usersService.createUsuario({
      ...normalizado,
      senha: senhaHash
    });
  }
}
