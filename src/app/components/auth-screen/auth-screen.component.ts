import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthMode, FeedbackType, LoginPayload, RegisterPayload } from '../../core/models';

@Component({
  selector: 'app-auth-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-screen.component.html'
})
export class AuthScreenComponent implements OnChanges {
  @Input({ required: true }) authMode: AuthMode = 'login';
  @Input() loginLoading = false;
  @Input() registerLoading = false;
  @Input() firebasePronto = true;
  @Input() loginError = '';
  @Input() registerFeedback = '';
  @Input() registerFeedbackType: FeedbackType = 'info';
  @Input() loginPreenchido = '';

  @Output() authModeChange = new EventEmitter<AuthMode>();
  @Output() loginSubmit = new EventEmitter<LoginPayload>();
  @Output() registerSubmit = new EventEmitter<RegisterPayload>();

  login = '';
  senha = '';
  registerNome = '';
  registerLogin = '';
  registerSenha = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loginPreenchido'] && this.loginPreenchido) {
      this.login = this.loginPreenchido;
    }
  }

  setMode(mode: AuthMode): void {
    this.authModeChange.emit(mode);
  }

  submitLogin(): void {
    this.loginSubmit.emit({
      login: this.login,
      senha: this.senha
    });
  }

  submitRegister(): void {
    this.registerSubmit.emit({
      nome: this.registerNome,
      login: this.registerLogin,
      senha: this.registerSenha
    });
  }

  feedbackClasses(type: FeedbackType): string[] {
    return ['feedback', `feedback-${type}`];
  }
}
