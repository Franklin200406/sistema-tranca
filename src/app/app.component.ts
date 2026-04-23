import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { AuthScreenComponent } from './components/auth-screen/auth-screen.component';
import { DashboardHeaderComponent } from './components/dashboard-header/dashboard-header.component';
import { LockPanelComponent } from './components/lock-panel/lock-panel.component';
import { LogsPanelComponent } from './components/logs-panel/logs-panel.component';
import { UsersPanelComponent } from './components/users-panel/users-panel.component';
import {
  AuthMode,
  FeedbackType,
  LockStatus,
  LogEntry,
  LogViewItem,
  LoginPayload,
  RegisterPayload,
  TrancaState,
  TrancaUltimaAtualizacao,
  Usuario,
  UsuarioLogado,
  UserViewItem
} from './core/models';
import { AuthService } from './services/auth.service';
import { DatabaseService } from './services/database.service';
import { LogsService } from './services/logs.service';
import { TrancaService } from './services/tranca.service';
import { UsersService } from './services/users.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    AuthScreenComponent,
    DashboardHeaderComponent,
    LockPanelComponent,
    LogsPanelComponent,
    UsersPanelComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly databaseService = inject(DatabaseService);
  private readonly usersService = inject(UsersService);
  private readonly authService = inject(AuthService);
  private readonly trancaService = inject(TrancaService);
  private readonly logsService = inject(LogsService);

  authMode: AuthMode = 'login';
  logado = false;
  loginLoading = false;
  registerLoading = false;
  firebasePronto = this.databaseService.isReady();
  loginPreenchidoAposCadastro = '';

  loginError = '';
  registerFeedback = '';
  registerFeedbackType: FeedbackType = 'info';
  dashboardFeedback = '';
  dashboardFeedbackType: FeedbackType = 'info';

  usuarioLogado: UsuarioLogado | null = null;
  usuariosCache: Record<string, Usuario> = {};
  trancaStatusAtual: LockStatus = 'travada';
  ultimaAcao = 'Nenhuma';
  logsSnapshotCache: Record<string, Omit<LogEntry, 'id'>> = {};
  private ultimaNotificacaoTranca = '';

  adminUsuarioSelecionadoId: string | null = null;
  adminUsuariosPagina = 1;
  readonly adminPageSize = 6;
  logsPagina = 1;
  readonly logsPageSize = 6;

  constructor() {
    if (!this.firebasePronto) {
      this.loginError =
        'Preencha todos os campos do firebaseConfig para carregar usuarios, status da tranca e logs.';
      return;
    }

    this.inicializarRealtime();
  }

  get usuarioAtualLogin(): string {
    return this.usuarioLogado?.login || '-';
  }

  get usuarioAtualId(): string {
    return this.usuarioLogado?.id || '-';
  }

  get usuarioAtualNivel(): string {
    return this.usuarioLogado?.nivel || '-';
  }

  get usuarioAtualStatus(): string {
    return this.usuarioLogado?.ativo ? 'ativo' : 'inativo';
  }

  get dashboardMessage(): string {
    if (!this.usuarioLogado) {
      return 'O status exibido abaixo e sincronizado instantaneamente com o Firebase Realtime Database.';
    }

    return `Usuario ${this.usuarioLogado.login} autenticado. O botao central alterna o valor de tranca/status e registra a acao em logs.`;
  }

  get lockStatusLabel(): string {
    return this.trancaStatusAtual === 'travada' ? 'TRANCADA' : 'ABERTA';
  }

  get statusText(): string {
    return this.trancaStatusAtual === 'travada' ? 'Travada' : 'Destravada';
  }

  get nextActionText(): string {
    return this.trancaStatusAtual === 'travada' ? 'Abrir' : 'Travar';
  }

  get lockStatusHint(): string {
    if (!this.logado) {
      return 'Faca login para controlar';
    }

    if (this.bloqueadoPorPermissao()) {
      return 'Sem permissao para destrancar';
    }

    return 'Clique para alternar';
  }

  get lockButtonClasses(): string[] {
    return ['lock-button', this.trancaStatusAtual === 'travada' ? 'is-locked' : 'is-open'];
  }

  get lockIcon(): string {
    return this.trancaStatusAtual === 'travada' ? 'lock' : 'lock_open';
  }

  get podeInteragirComTranca(): boolean {
    return this.logado && this.firebasePronto && !this.bloqueadoPorPermissao();
  }

  get usuariosOrdenados(): Array<[string, Usuario]> {
    return Object.entries(this.usuariosCache).sort(([, a], [, b]) =>
      String(a?.login || '').localeCompare(String(b?.login || ''), 'pt-BR', {
        sensitivity: 'base'
      })
    );
  }

  get totalPaginasAdmin(): number {
    return Math.max(1, Math.ceil(this.usuariosOrdenados.length / this.adminPageSize));
  }

  get usuariosPaginados(): Array<[string, Usuario]> {
    const start = (this.adminUsuariosPagina - 1) * this.adminPageSize;
    return this.usuariosOrdenados.slice(start, start + this.adminPageSize);
  }

  get usuariosPaginadosView(): UserViewItem[] {
    return this.usuariosPaginados.map(([id, usuario]) => ({
      id,
      login: usuario.login || id,
      ativo: Boolean(usuario.ativo),
      nivel: usuario.nivel || '-',
      podeDestrancar: this.usuarioPodeDestrancar(usuario)
    }));
  }

  get logsOrdenados(): LogEntry[] {
    return Object.entries(this.logsSnapshotCache)
      .map(([id, value]) => ({ id, ...value }))
      .sort(
        (a, b) => new Date(b.data_hora || 0).getTime() - new Date(a.data_hora || 0).getTime()
      );
  }

  get totalPaginasLogs(): number {
    return Math.max(1, Math.ceil(this.logsOrdenados.length / this.logsPageSize));
  }

  get logsPaginados(): LogEntry[] {
    const start = (this.logsPagina - 1) * this.logsPageSize;
    return this.logsOrdenados.slice(start, start + this.logsPageSize);
  }

  get logsCounterText(): string {
    const total = this.logsOrdenados.length;
    return `${total} ${total === 1 ? 'registro' : 'registros'}`;
  }

  get logsPaginadosView(): LogViewItem[] {
    return this.logsPaginados.map((entry) => ({
      id: entry.id,
      usuarioId: entry.usuario_id || '-',
      usuarioLogin: this.obterLoginUsuario(entry.usuario_id),
      acao: entry.acao || '-',
      resultado: entry.resultado || '-',
      dataHora: this.formatDateTime(entry.data_hora)
    }));
  }

  usuarioEhAdmin(): boolean {
    return String(this.usuarioLogado?.nivel || '').toLowerCase() === 'proprietario';
  }

  usuarioPodeDestrancar(usuario: Usuario | UsuarioLogado | null): boolean {
    if (!usuario) {
      return false;
    }

    if (typeof usuario.pode_destrancar === 'boolean') {
      return usuario.pode_destrancar;
    }

    if (typeof usuario.podeDestrancar === 'boolean') {
      return usuario.podeDestrancar;
    }

    return true;
  }

  setAuthMode(mode: AuthMode): void {
    this.authMode = mode;
  }

  paginaAnteriorAdmin(): void {
    this.adminUsuariosPagina = Math.max(1, this.adminUsuariosPagina - 1);
    this.adminUsuarioSelecionadoId = null;
  }

  proximaPaginaAdmin(): void {
    this.adminUsuariosPagina = Math.min(this.totalPaginasAdmin, this.adminUsuariosPagina + 1);
    this.adminUsuarioSelecionadoId = null;
  }

  paginaAnteriorLogs(): void {
    this.logsPagina = Math.max(1, this.logsPagina - 1);
  }

  proximaPaginaLogs(): void {
    this.logsPagina = Math.min(this.totalPaginasLogs, this.logsPagina + 1);
  }

  toggleUsuarioExpandido(userId: string): void {
    this.adminUsuarioSelecionadoId = this.adminUsuarioSelecionadoId === userId ? null : userId;
  }

  async onLoginSubmit(payload: LoginPayload): Promise<void> {
    this.clearLoginError();

    if (!this.firebasePronto) {
      this.showLoginError(
        'Preencha o firebaseConfig com as credenciais do seu projeto antes de entrar.'
      );
      return;
    }

    this.loginLoading = true;

    try {
      const { usuarioLogado, usuarios } = await this.authService.autenticar(payload);
      this.usuariosCache = usuarios;
      this.usuarioLogado = usuarioLogado;
      this.logado = true;
      this.clearDashboardFeedback();
      this.loginPreenchidoAposCadastro = '';
      this.adminUsuariosPagina = 1;
      this.logsPagina = 1;
    } catch (error) {
      this.showLoginError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel consultar os usuarios no Firebase. Revise o firebaseConfig e a databaseURL.'
      );
    } finally {
      this.loginLoading = false;
    }
  }

  async onRegisterSubmit(payload: RegisterPayload): Promise<void> {
    this.clearRegisterFeedback();

    if (!this.firebasePronto) {
      this.showRegisterFeedback('Preencha o firebaseConfig antes de cadastrar usuarios.', 'error');
      return;
    }

    this.registerLoading = true;

    try {
      await this.authService.cadastrar(payload);
      this.showRegisterFeedback('Cadastro realizado com sucesso. Agora faca login.', 'success');
      this.authMode = 'login';
      this.loginPreenchidoAposCadastro = payload.login.trim();
    } catch (error) {
      this.showRegisterFeedback(
        error instanceof Error ? error.message : 'Nao foi possivel cadastrar o usuario no Firebase.',
        'error'
      );
    } finally {
      this.registerLoading = false;
    }
  }

  logout(): void {
    this.logado = false;
    this.usuarioLogado = null;
    this.adminUsuarioSelecionadoId = null;
    this.adminUsuariosPagina = 1;
    this.logsPagina = 1;
    this.ultimaAcao = 'Nenhuma';
    this.clearDashboardFeedback();
    this.clearLoginError();
  }

  async alternarTranca(): Promise<void> {
    if (!this.usuarioLogado?.id) {
      this.showLoginError('Faca login antes de tentar controlar a tranca.');
      return;
    }

    const proximoStatus: LockStatus =
      this.trancaStatusAtual === 'travada' ? 'destravada' : 'travada';
    const acao: 'abrir' | 'travar' = proximoStatus === 'destravada' ? 'abrir' : 'travar';

    if (proximoStatus === 'destravada' && !this.usuarioPodeDestrancar(this.usuarioLogado)) {
      this.showDashboardFeedback('Voce nao tem permissao para destrancar o cofre.', 'error');
      return;
    }

    this.clearDashboardFeedback();

    try {
      await this.trancaService.atualizarStatus(proximoStatus, acao, this.usuarioLogado);
      this.ultimaAcao = this.capitalize(acao);
      this.showDashboardFeedback(
        proximoStatus === 'destravada'
          ? 'Tranca destravada com sucesso.'
          : 'Tranca travada com sucesso.',
        'success'
      );

      try {
        await this.logsService.registrarLog(this.usuarioLogado.id, acao, 'sucesso');
      } catch (logError) {
        console.error(logError);
        this.showDashboardFeedback(
          'A tranca foi atualizada, mas nao foi possivel registrar o log. Verifique as regras do Firebase para o no logs.',
          'error'
        );
      }
    } catch (error) {
      console.error(error);

      try {
        await this.logsService.registrarLog(this.usuarioLogado.id, acao, 'erro');
      } catch (logError) {
        console.error(logError);
      }

      this.showDashboardFeedback(
        'Nao foi possivel atualizar tranca/status. Verifique as regras de escrita do Firebase para o no tranca.',
        'error'
      );
    }
  }

  async atualizarPermissaoUsuario(userId: string, event: Event): Promise<void> {
    if (!this.usuarioEhAdmin()) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const permitir = input.checked;
    input.disabled = true;
    this.clearDashboardFeedback();

    try {
      await this.usersService.updatePermissao(userId, permitir);
      this.showDashboardFeedback(
        permitir
          ? 'Permissao atualizada: usuario pode destrancar.'
          : 'Permissao atualizada: usuario nao pode destrancar.',
        'success'
      );
    } catch (error) {
      console.error(error);
      input.checked = !permitir;
      this.showDashboardFeedback('Nao foi possivel atualizar a permissao do usuario.', 'error');
    } finally {
      input.disabled = false;
    }
  }

  formatDateTime(dateValue?: string): string {
    const parsed = new Date(dateValue || '');

    if (Number.isNaN(parsed.getTime())) {
      return dateValue || '-';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(parsed);
  }

  obterLoginUsuario(userId?: string): string {
    if (!userId) {
      return 'desconhecido';
    }

    return this.usuariosCache[userId]?.login || userId;
  }

  private inicializarRealtime(): void {
    const unsubscribeUsuarios = this.usersService.watchUsuarios((snapshot) => {
      this.processarUsuarios(snapshot);
    });
    const unsubscribeTranca = this.trancaService.watchTranca((tranca) => {
      this.processarTranca(tranca);
    });
    const unsubscribeLogs = this.logsService.watchLogs((logs) => {
      this.logsSnapshotCache = logs;
      this.ajustarPaginacaoLogs();
    });

    if (unsubscribeUsuarios) {
      this.destroyRef.onDestroy(unsubscribeUsuarios);
    }
    if (unsubscribeTranca) {
      this.destroyRef.onDestroy(unsubscribeTranca);
    }
    if (unsubscribeLogs) {
      this.destroyRef.onDestroy(unsubscribeLogs);
    }
  }

  private processarUsuarios(snapshot: any): void {
    this.usuariosCache = (snapshot.val() || {}) as Record<string, Usuario>;

    if (this.usuarioLogado?.id && !this.usuariosCache[this.usuarioLogado.id]?.ativo) {
      this.logado = false;
      this.usuarioLogado = null;
      this.showLoginError('Seu acesso foi desativado. Faca login novamente com um usuario ativo.');
      return;
    }

    if (this.usuarioLogado?.id && this.usuariosCache[this.usuarioLogado.id]) {
      this.usuarioLogado = {
        id: this.usuarioLogado.id,
        ...this.usuariosCache[this.usuarioLogado.id]
      };
    }

    this.ajustarPaginacaoAdmin();
  }

  private processarTranca(tranca: TrancaState): void {
    this.trancaStatusAtual = (tranca.status || 'travada') as LockStatus;
    this.processarAtualizacaoRemotaTranca(tranca.ultimaAtualizacao);
  }

  private ajustarPaginacaoAdmin(): void {
    this.adminUsuariosPagina = Math.min(this.adminUsuariosPagina, this.totalPaginasAdmin);
    this.adminUsuariosPagina = Math.max(1, this.adminUsuariosPagina);

    const idsValidos = new Set(this.usuariosPaginados.map(([id]) => id));
    if (this.adminUsuarioSelecionadoId && !idsValidos.has(this.adminUsuarioSelecionadoId)) {
      this.adminUsuarioSelecionadoId = null;
    }
  }

  private ajustarPaginacaoLogs(): void {
    this.logsPagina = Math.min(this.logsPagina, this.totalPaginasLogs);
    this.logsPagina = Math.max(1, this.logsPagina);
  }

  private capitalize(value: string): string {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  private processarAtualizacaoRemotaTranca(
    ultimaAtualizacao?: TrancaUltimaAtualizacao
  ): void {
    if (!ultimaAtualizacao?.data_hora) {
      return;
    }

    const chaveNotificacao = [
      ultimaAtualizacao.usuario_id || '',
      ultimaAtualizacao.acao || '',
      ultimaAtualizacao.data_hora
    ].join('|');

    if (this.ultimaNotificacaoTranca === chaveNotificacao) {
      return;
    }

    this.ultimaNotificacaoTranca = chaveNotificacao;

    if (!this.logado || !this.usuarioLogado?.id) {
      return;
    }

    if (ultimaAtualizacao.usuario_id === this.usuarioLogado.id) {
      return;
    }

    const usuario = ultimaAtualizacao.usuario_login || ultimaAtualizacao.usuario_id || 'Outro usuario';
    const acao = ultimaAtualizacao.acao === 'abrir' ? 'destrancou' : 'trancou';
    const horario = this.formatDateTime(ultimaAtualizacao.data_hora);

    this.ultimaAcao = this.capitalize(ultimaAtualizacao.acao || 'Nenhuma');
    this.showDashboardFeedback(`${usuario} ${acao} a tranca em ${horario}.`, 'info');
  }

  private bloqueadoPorPermissao(): boolean {
    return (
      this.logado &&
      this.trancaStatusAtual === 'travada' &&
      !this.usuarioPodeDestrancar(this.usuarioLogado)
    );
  }

  private showLoginError(message: string): void {
    this.loginError = message;
  }

  private clearLoginError(): void {
    this.loginError = '';
  }

  private showRegisterFeedback(message: string, type: FeedbackType): void {
    this.registerFeedback = message;
    this.registerFeedbackType = type;
  }

  private clearRegisterFeedback(): void {
    this.registerFeedback = '';
    this.registerFeedbackType = 'info';
  }

  private showDashboardFeedback(message: string, type: FeedbackType): void {
    this.dashboardFeedback = message;
    this.dashboardFeedbackType = type;
  }

  private clearDashboardFeedback(): void {
    this.dashboardFeedback = '';
    this.dashboardFeedbackType = 'info';
  }
}
