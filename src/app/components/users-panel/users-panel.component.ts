import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UserViewItem } from '../../core/models';

@Component({
  selector: 'app-users-panel',
  standalone: true,
  templateUrl: './users-panel.component.html'
})
export class UsersPanelComponent {
  @Input() usuarios: UserViewItem[] = [];
  @Input() usuarioSelecionadoId: string | null = null;
  @Input() adminUsuariosPagina = 1;
  @Input() totalPaginasAdmin = 1;

  @Output() toggleUsuario = new EventEmitter<string>();
  @Output() atualizarPermissao = new EventEmitter<{ userId: string; event: Event }>();
  @Output() paginaAnterior = new EventEmitter<void>();
  @Output() proximaPagina = new EventEmitter<void>();

  usuarioExpandido(userId: string): boolean {
    return this.usuarioSelecionadoId === userId;
  }
}
