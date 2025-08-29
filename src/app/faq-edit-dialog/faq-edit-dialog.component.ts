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
  selector: 'app-faq-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <h2>Edit FAQ Answer</h2>

    <div class="input-field">
      <label>Question:</label>
      <p>{{ data.question }}</p>
    </div>

    <form #editForm="ngForm" (ngSubmit)="submitForm(editForm)" novalidate>
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
        <button type="submit" [disabled]="editForm.invalid" class="nextBtn">Save</button>
        <button type="button" (click)="onCancel()" class="cancelBtn">Cancel</button>
      </div>
    </form>
  `,
  styles: [`
    /* Use your desired styles here, you can reuse the style from previous dialog */
    :host {
      display: block;
      max-width: 520px;
      padding: 24px;
      background: #fffaf8;
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(92, 62, 66, 0.15);
      font-family: Arial, sans-serif;
    }
    h2 {
      margin-top: 0;
      color: #B22234;
      border-left: 6px solid #B22234;
      padding-left: 16px;
      font-weight: 700;
      font-size: 2rem;
      margin-bottom: 16px;
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
      max-width: 100%;
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
      padding: 8px 16px;
      font-size: 0.9rem;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
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
      padding: 8px 16px;
      background: none;
      border: 1px solid #ccc;
      border-radius: 10px;
      font-weight: 500;
      cursor: pointer;
      min-width: 120px;
    }
  `]
})
export class FaqEditDialogComponent {
  answer: string = '';

  constructor(
    public dialogRef: MatDialogRef<FaqEditDialogComponent>,
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
