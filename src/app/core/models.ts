export type FeedbackType = 'success' | 'error' | 'info';
export type AuthMode = 'login' | 'register';
export type LockStatus = 'travada' | 'destravada';

export interface Usuario {
  nome?: string;
  login?: string;
  senha?: string;
  senha_hash?: string;
  ativo?: boolean;
  nivel?: string;
  pode_destrancar?: boolean;
  podeDestrancar?: boolean;
}

export interface UsuarioLogado extends Usuario {
  id: string;
}

export interface LogEntry {
  id: string;
  usuario_id?: string;
  acao?: string;
  resultado?: string;
  data_hora?: string;
}

export interface TrancaUltimaAtualizacao {
  usuario_id?: string;
  usuario_login?: string;
  acao?: string;
  data_hora?: string;
}

export interface TrancaState {
  status?: LockStatus;
  ultimaAtualizacao?: TrancaUltimaAtualizacao;
}

export interface LoginPayload {
  login: string;
  senha: string;
}

export interface RegisterPayload {
  nome: string;
  login: string;
  senha: string;
}

export interface LogViewItem {
  id: string;
  usuarioId: string;
  usuarioLogin: string;
  acao: string;
  resultado: string;
  dataHora: string;
}

export interface UserViewItem {
  id: string;
  login: string;
  ativo: boolean;
  nivel: string;
  podeDestrancar: boolean;
}
