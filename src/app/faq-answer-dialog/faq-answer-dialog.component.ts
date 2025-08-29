import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface FaqQuestion {
  _id: string;
  question: string;
  answer: string;
  createdAt: Date;
  status: 'pending' | 'answered' | 'archived';
}

@Component({
  selector: 'app-faq-answer-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <form #responseForm="ngForm" (ngSubmit)="submitForm(responseForm)" novalidate>
      <h2>Answer FAQ</h2>

      <div class="input-field">
        <label>Question:</label>
        <p>{{ data.question }}</p>
      </div>

      <div class="input-field">
        <label>Your Answer</label>
        <textarea
          name="answer"
          required
          rows="6"
          [(ngModel)]="answer"
          #answerInput="ngModel"
          placeholder="Type your answer here..."
        ></textarea>
        <div *ngIf="answerInput.invalid && answerInput.touched" class="error">
          Answer is required
        </div>
      </div>

      <div class="button-group">
        <button type="submit" [disabled]="responseForm.invalid" class="nextBtn">Save Answer</button>
        <button type="button" (click)="onCancel()" class="cancelBtn">Cancel</button>
      </div>
    </form>
  `,
  styles: [`
    form {
      background: #fffaf8;
      border-radius: 20px;
      padding: 40px;
      max-width: 490px;
      width: 100%;
      box-shadow: 0 8px 30px rgba(92, 62, 66, 0.15);
      margin: auto;
    }
    h2 {
      font-size: 2.2rem;
      color: #B22234;
      font-weight: 700;
      margin-bottom: 20px;
      border-left: 6px solid #B22234;
      padding-left: 16px;
    }
    .input-field {
      display: flex;
      flex-direction: column;
      margin-bottom: 20px;
    }
    .input-field label {
      font-weight: 600;
      color: #B22234;
      margin-bottom: 8px;
      font-size: 1rem;
    }
    textarea {
      resize: vertical;
      padding: 6px;
      font-size: 0.9rem;
      border: 2px solid #f4c6c6;
      border-radius: 10px;
      color: #3d3d3d;
      min-height: 150px;
      max-width: 450px;
      width: 100%;
    }
    textarea:focus {
      outline: none;
      border-color: #B22234;
      box-shadow: 0 0 5px rgba(178, 34, 52, 0.3);
    }
    .error {
      font-size: 0.85rem;
      color: #C62828;
      margin-top: 5px;
    }
    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .nextBtn {
      background: linear-gradient(to right, #B22234, #911c2a);
      color: white;
      padding: 8px 12px;
      font-size: 0.9rem;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      width: auto;
      min-width: 120px;
      box-shadow: 0 6px 20px rgba(178, 34, 52, 0.25);
      transition: all 0.3s ease;
      margin-bottom: 0;
    }
    .nextBtn:hover {
      background: linear-gradient(to right, #911c2a, #73151f);
      transform: translateY(-2px);
    }
    .nextBtn:disabled {
      background: #f8d7da;
      color: #999;
      cursor: not-allowed;
    }
    button.cancelBtn {
      margin-top: 0;
      padding: 8px 12px;
      background: none;
      border: 1px solid #ccc;
      border-radius: 10px;
      font-weight: 500;
      cursor: pointer;
      width: auto;
      min-width: 120px;
    }
  `],
})
export class FaqAnswerDialogComponent {
  answer: string = '';

  constructor(
    public dialogRef: MatDialogRef<FaqAnswerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FaqQuestion
  ) {
    this.answer = data.answer || '';
  }

  submitForm(form: NgForm) {
    if (form.invalid) return;
    this.dialogRef.close(this.answer);
  }

  onCancel() {
    this.dialogRef.close(null);
  }
}
