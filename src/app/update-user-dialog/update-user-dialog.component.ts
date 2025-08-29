import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-update-user-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <form #responseForm="ngForm" (ngSubmit)="submitForm(responseForm)" novalidate>
      <h2>Respond to Report</h2>

      <div class="input-field">
        <label>Your Response</label>
        <textarea
          name="response"
          required
          rows="4"
          [(ngModel)]="response"
          #responseInput="ngModel"
          placeholder="Type your response here..."
        ></textarea>
        <div *ngIf="responseInput.invalid && responseInput.touched" class="error">
          Response is required
        </div>
      </div>

      <div class="button-group">
        <button type="submit" [disabled]="responseForm.invalid" class="nextBtn">Send Response</button>
        <button type="button" (click)="onCancel()" class="cancelBtn">Cancel</button>
      </div>
    </form>
  `,
  styles: [
    `
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
        max-width: 450px; /* limit width */
        width: 100%; /* responsive */
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
        gap: 12px; /* space between buttons */
        margin-top: 10px;
        flex-wrap: wrap; /* wrap on small screens */
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
        margin-bottom: 0; /* removed extra bottom margin */
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
    `,
  ],
})
export class UpdateUserDialogComponent {
  response: string = '';

  constructor(public dialogRef: MatDialogRef<UpdateUserDialogComponent>) {}

  submitForm(form: NgForm) {
    if (form.invalid) return;
    this.dialogRef.close(this.response);
  }

  onCancel() {
    this.dialogRef.close(null);
  }
}
