import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy
} from '@angular/core';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, DoughnutController } from 'chart.js';
import { LogAcao, LogEntry, LockStatus, Usuario } from '../../core/models';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, DoughnutController);

export interface DashboardStats {
  totalUsuarios: number;
  usuariosAtivos: number;
  totalEventos: number;
  eventosHoje: number;
  totalAberturas: number;
  totalFechamentos: number;
  totalTentativas: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('activityChart') activityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('distributionChart') distributionCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() usuariosCache: Record<string, Usuario> = {};
  @Input() logsCache: Record<string, Omit<LogEntry, 'id'>> = {};
  @Input() trancaStatusAtual: LockStatus = 'travada';
  @Input() usuarioLogadoNome = '';
  @Input() usuarioLogadoId = '';
  @Input() usuarioLogadoNivel = '';

  @Output() logout = new EventEmitter<void>();
  @Output() toggleUserPermission = new EventEmitter<{ userId: string; event: Event }>();

  private activityChartInstance: Chart | null = null;
  private distributionChartInstance: Chart | null = null;

  readonly acoesAbertura: LogAcao[] = ['abertura_senha', 'abrir'];
  readonly acoesTentativa: LogAcao[] = ['senha_incorreta'];
  readonly acoesFechamento: LogAcao[] = ['travar'];

  usuariosPagina = 1;
  readonly pageSize = 8;
  logsPagina = 1;
  readonly logsPageSize = 10;
  logTipoFiltro: 'todos' | 'aberturas' | 'tentativas' | 'fechamentos' = 'todos';

  get stats(): DashboardStats {
    const usuarios = Object.values(this.usuariosCache);
    const logs = Object.values(this.logsCache);
    const hoje = new Date().toISOString().slice(0, 10);
    const eventosHoje = logs.filter(l => l.data_hora?.startsWith(hoje)).length;
    const totalAberturas = logs.filter(l => this.acoesAbertura.includes(l.acao as LogAcao)).length;
    const totalFechamentos = logs.filter(l => this.acoesFechamento.includes(l.acao as LogAcao)).length;
    const totalTentativas = logs.filter(l => this.acoesTentativa.includes(l.acao as LogAcao)).length;

    return {
      totalUsuarios: usuarios.length,
      usuariosAtivos: usuarios.filter(u => u.ativo).length,
      totalEventos: logs.length,
      eventosHoje,
      totalAberturas,
      totalFechamentos,
      totalTentativas
    };
  }

  get usuariosOrdenados(): Array<[string, Usuario]> {
    return Object.entries(this.usuariosCache).sort(([, a], [, b]) =>
      String(a?.login || '').localeCompare(String(b?.login || ''), 'pt-BR', { sensitivity: 'base' })
    );
  }

  get totalPaginasUsuarios(): number {
    return Math.max(1, Math.ceil(this.usuariosOrdenados.length / this.pageSize));
  }

  get usuariosPaginados(): Array<[string, Usuario]> {
    const start = (this.usuariosPagina - 1) * this.pageSize;
    return this.usuariosOrdenados.slice(start, start + this.pageSize);
  }

  get logsOrdenados(): LogEntry[] {
    const entries = Object.entries(this.logsCache)
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => new Date(b.data_hora || 0).getTime() - new Date(a.data_hora || 0).getTime());

    if (this.logTipoFiltro === 'aberturas') {
      return entries.filter(e => this.acoesAbertura.includes(e.acao as LogAcao));
    }
    if (this.logTipoFiltro === 'tentativas') {
      return entries.filter(e => this.acoesTentativa.includes(e.acao as LogAcao));
    }
    if (this.logTipoFiltro === 'fechamentos') {
      return entries.filter(e => this.acoesFechamento.includes(e.acao as LogAcao));
    }
    return entries;
  }

  get totalPaginasLogs(): number {
    return Math.max(1, Math.ceil(this.logsOrdenados.length / this.logsPageSize));
  }

  get logsPaginados(): LogEntry[] {
    const start = (this.logsPagina - 1) * this.logsPageSize;
    return this.logsOrdenados.slice(start, start + this.logsPageSize);
  }

  get logsRecentes(): LogEntry[] {
    return this.logsPaginados;
  }

  get ultimaAbertura(): LogEntry | null {
    return this.logsOrdenados.find(e => this.acoesAbertura.includes(e.acao as LogAcao)) || null;
  }

  get tentativasHoje(): number {
    const hoje = new Date().toISOString().slice(0, 10);
    return Object.values(this.logsCache).filter(
      l => l.acao === 'senha_incorreta' && l.data_hora?.startsWith(hoje)
    ).length;
  }

  get ultimaTentativaInvalida(): LogEntry | null {
    return this.logsOrdenados.find(e => this.acoesTentativa.includes(e.acao as LogAcao)) || null;
  }

  getChartColors(): string[] {
    return ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
  }

  get activityData(): { labels: string[]; values: number[] } {
    const days: string[] = [];
    const values: number[] = [];
    const hoje = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push(d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }));
      const count = Object.values(this.logsCache).filter(l => l.data_hora?.startsWith(key)).length;
      values.push(count);
    }

    return { labels: days, values };
  }

  get distributionData(): { labels: string[]; values: number[]; colors: string[] } {
    return {
      labels: ['Aberturas', 'Fechamentos', 'Tentativas'],
      values: [this.stats.totalAberturas, this.stats.totalFechamentos, this.stats.totalTentativas],
      colors: ['#10b981', '#3b82f6', '#ef4444']
    };
  }

  get ultimosSeteDias(): string[] {
    const days: string[] = [];
    const hoje = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }

  obterLoginUsuario(userId?: string): string {
    if (!userId) return 'desconhecido';
    return this.usuariosCache[userId]?.login || userId;
  }

  getFirstChar(value: string | undefined | null): string {
    return (value || '?')[0].toUpperCase();
  }

  formatDateTime(dateValue?: string): string {
    const parsed = new Date(dateValue || '');
    if (Number.isNaN(parsed.getTime())) return dateValue || '-';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(parsed);
  }

  usuarioPodeDestrancar(usuario: Usuario): boolean {
    if (typeof usuario.pode_destrancar === 'boolean') return usuario.pode_destrancar;
    if (typeof usuario.podeDestrancar === 'boolean') return usuario.podeDestrancar;
    return true;
  }

  paginaAnterior(): void {
    this.usuariosPagina = Math.max(1, this.usuariosPagina - 1);
  }

  proximaPagina(): void {
    this.usuariosPagina = Math.min(this.totalPaginasUsuarios, this.usuariosPagina + 1);
  }

  setFiltroLog(filtro: 'todos' | 'aberturas' | 'tentativas' | 'fechamentos'): void {
    this.logTipoFiltro = filtro;
    this.logsPagina = 1;
  }

  paginaAnteriorLogs(): void {
    this.logsPagina = Math.max(1, this.logsPagina - 1);
  }

  proximaPaginaLogs(): void {
    this.logsPagina = Math.min(this.totalPaginasLogs, this.logsPagina + 1);
  }

  acaoLabel(acao: LogAcao | undefined | null): string {
    switch (acao) {
      case 'abertura_senha': return 'Abertura (teclado)';
      case 'senha_incorreta': return 'Tentativa invalida';
      case 'abrir': return 'Abertura (remoto)';
      case 'travar': return 'Fechamento';
      default: return acao || '-';
    }
  }

  acaoIcon(acao: LogAcao | undefined | null): string {
    switch (acao) {
      case 'abertura_senha': return 'lock_open';
      case 'senha_incorreta': return 'error';
      case 'abrir': return 'lock_open_right';
      case 'travar': return 'lock';
      default: return 'help_outline';
    }
  }

  acaoBadgeClasse(acao: LogAcao | undefined | null): string {
    switch (acao) {
      case 'abertura_senha': return 'badge-acao badge-teclado';
      case 'senha_incorreta': return 'badge-acao badge-tentativa';
      case 'abrir': return 'badge-acao badge-remoto';
      case 'travar': return 'badge-acao badge-fechamento';
      default: return 'badge-acao';
    }
  }

  origemLabel(origem: 'teclado' | 'site' | undefined | null): string {
    switch (origem) {
      case 'teclado': return 'Teclado';
      case 'site': return 'Remoto';
      default: return '-';
    }
  }

  onTogglePermission(userId: string, event: Event): void {
    this.toggleUserPermission.emit({ userId, event });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.activityChartInstance && (changes['logsCache'] || changes['trancaStatusAtual'])) {
      this.updateCharts();
    }
  }

  ngAfterViewInit(): void {
    this.initCharts();
  }

  ngOnDestroy(): void {
    this.activityChartInstance?.destroy();
    this.distributionChartInstance?.destroy();
  }

  private initCharts(): void {
    this.createActivityChart();
    this.createDistributionChart();
  }

  private updateCharts(): void {
    this.createActivityChart();
    this.createDistributionChart();
  }

  private createActivityChart(): void {
    if (!this.activityCanvas?.nativeElement) return;
    this.activityChartInstance?.destroy();

    const data = this.activityData;
    const ctx = this.activityCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.activityChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Eventos',
          data: data.values,
          backgroundColor: ['#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6'],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: '#64748b',
              font: { size: 11 }
            },
            grid: { color: '#e2e8f0' }
          },
          x: {
            ticks: {
              color: '#64748b',
              font: { size: 11 }
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  private createDistributionChart(): void {
    if (!this.distributionCanvas?.nativeElement) return;
    this.distributionChartInstance?.destroy();

    const data = this.distributionData;
    const ctx = this.distributionCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.distributionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: data.colors,
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 12,
              color: '#475569',
              font: { size: 12, weight: 600 }
            }
          }
        }
      }
    });
  }
}
