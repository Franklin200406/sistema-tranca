import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  templateUrl: './dashboard-header.component.html'
})
export class DashboardHeaderComponent {
  @Input() usuarioLogin = '-';
  @Input() usuarioId = '-';
  @Input() usuarioNivel = '-';
  @Input() usuarioStatus = '-';

  @Output() logout = new EventEmitter<void>();
}
