import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FeedbackType } from '../../core/models';

@Component({
  selector: 'app-lock-panel',
  standalone: true,
  templateUrl: './lock-panel.component.html'
})
export class LockPanelComponent {
  @Input() dashboardMessage = '';
  @Input() dashboardFeedback = '';
  @Input() dashboardFeedbackType: FeedbackType = 'info';
  @Input() lockButtonClasses: string[] = [];
  @Input() podeInteragirComTranca = false;
  @Input() lockIcon = 'lock';
  @Input() lockStatusLabel = 'TRANCADA';
  @Input() lockStatusHint = '';
  @Input() statusText = '';
  @Input() nextActionText = '';
  @Input() ultimaAcao = '';

  @Output() alternarTranca = new EventEmitter<void>();

  feedbackClasses(type: FeedbackType): string[] {
    return ['feedback', `feedback-${type}`];
  }
}
