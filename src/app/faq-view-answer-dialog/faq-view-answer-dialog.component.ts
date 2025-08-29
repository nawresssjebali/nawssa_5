import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface FaqQuestion {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq-view-answer-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2>FAQ Answer</h2>

    <div class="details-field"><strong>Question:</strong> {{ data.question }}</div>

    <div class="details-field"><strong>Answer:</strong> {{ data.answer }}</div>

    <button mat-button color="primary" (click)="close()">Close</button>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 480px;
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
    .details-field {
      margin-bottom: 12px;
      font-size: 1rem;
      color: #3d3d3d;
      white-space: pre-wrap;
    }
    button {
      margin-top: 20px;
      border-radius: 10px;
      padding: 8px 16px;
      font-weight: 600;
      cursor: pointer;
      background: linear-gradient(to right, #B22234, #911c2a);
      color: white;
      border: none;
      transition: background 0.3s ease;
    }
    button:hover {
      background: linear-gradient(to right, #911c2a, #73151f);
    }
  `]
})
export class FaqViewAnswerDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<FaqViewAnswerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FaqQuestion
  ) {}

  close() {
    this.dialogRef.close();
  }
}
