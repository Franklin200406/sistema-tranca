import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LogViewItem } from '../../core/models';

@Component({
  selector: 'app-logs-panel',
  standalone: true,
  templateUrl: './logs-panel.component.html'
})
export class LogsPanelComponent {
  @Input() logsCounterText = '0 registros';
  @Input() logs: LogViewItem[] = [];
  @Input() logsPagina = 1;
  @Input() totalPaginasLogs = 1;

  @Output() paginaAnterior = new EventEmitter<void>();
  @Output() proximaPagina = new EventEmitter<void>();
}
