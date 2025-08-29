import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface SecurityReport {
  description: string;
  response?: string;
  userId?: string;
  loginHistory?: any[];
  recentActivity?: any[];
  serverLogs?: string[];
}

@Component({
  selector: 'app-security-report-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2>Security Report Details</h2>

    <div class="details-field"><strong>Description:</strong> {{ data.description }}</div>

    <div class="details-field" *ngIf="data.response">
      <strong>Response:</strong> {{ data.response }}
    </div>

    <!-- LAST LOGIN -->
    <h3>Last Login</h3>
    <div *ngIf="lastLogin; else noLoginHistory">
      <div><strong>IP:</strong> {{ lastLogin.ip }}</div>
      <div><strong>Location:</strong> {{ lastLogin.location || 'N/A' }}</div>
      <div><strong>Time:</strong> {{ lastLogin.timestamp | date:'short' }}</div>
      <div><strong>User Agent:</strong> {{ lastLogin.userAgent || 'N/A' }}</div>
      <div><strong>Status:</strong> {{ lastLogin.success ? '✔️ Success' : '❌ Failed' }}</div>
      <div *ngIf="!lastLogin.success && lastLogin.failureReason"><strong>Failure Reason:</strong> {{ lastLogin.failureReason }}</div>
      <button mat-button color="primary" (click)="downloadLoginHistoryCsv()">Download Full Login History CSV</button>
    </div>
    <ng-template #noLoginHistory>
      <p>No login history found</p>
    </ng-template>

    <!-- LAST ACTIVITY -->
    <h3>Last Recent Activity</h3>
    <div *ngIf="lastActivity; else noRecentActivity">
      <div><strong>Description:</strong> {{ lastActivity.description || 'No description' }}</div>
      <div><strong>Time:</strong> {{ lastActivity.timestamp | date:'short' }}</div>
      <button mat-button color="primary" (click)="downloadRecentActivityCsv()">Download Full Recent Activity CSV</button>
    </div>
    <ng-template #noRecentActivity>
      <p>No recent activity found</p>
    </ng-template>

    <!-- SERVER LOGS -->
    <ng-container *ngIf="data.serverLogs?.length">
      <h3>Server Logs</h3>
      <ul>
        <li *ngFor="let log of data.serverLogs">{{ log }}</li>
      </ul>
    </ng-container>

    <button mat-button color="primary" (click)="close()">Close</button>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 600px;
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
    h3 {
      margin-top: 20px;
      color: #911c2a;
      font-size: 1.3rem;
      border-bottom: 2px solid #f0dede;
      padding-bottom: 4px;
    }
    .details-field {
      margin-bottom: 12px;
      font-size: 1rem;
      color: #3d3d3d;
    }
    ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }
    li {
      padding: 10px;
      background: #fff3f3;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 8px 0;
    }
    button {
      margin-top: 12px;
      border-radius: 10px;
      padding: 6px 12px;
      font-weight: 600;
      cursor: pointer;
      background: linear-gradient(to right, #B22234, #911c2a);
      color: white;
      border: none;
      transition: background 0.3s ease;
      margin-right: 8px;
    }
    button:hover {
      background: linear-gradient(to right, #911c2a, #73151f);
    }
  `]
})
export class SecurityReportDetailsDialogComponent {
  lastLogin: any | null = null;
  lastActivity: any | null = null;

  constructor(
    public dialogRef: MatDialogRef<SecurityReportDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SecurityReport
  ) {
    this.setLastLoginAndActivity();
  }

  setLastLoginAndActivity() {
    if (this.data.loginHistory?.length) {
      this.lastLogin = this.data.loginHistory.reduce((latest, current) =>
        new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
      );
    }
    if (this.data.recentActivity?.length) {
      this.lastActivity = this.data.recentActivity.reduce((latest, current) =>
        new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
      );
    }
  }

  downloadLoginHistoryCsv() {
    if (!this.data.loginHistory?.length) return;

    const headers = ['IP', 'Location', 'Time', 'User Agent', 'Status', 'Failure Reason'];

    const csvRows = [headers.join(',')];

    for (const row of this.data.loginHistory) {
      const values = [
        row.ip || '',
        row.location || '',
        row.timestamp ? new Date(row.timestamp).toLocaleString() : '',
        row.userAgent || '',
        row.success ? 'Success' : 'Failed',
        row.failureReason || ''
      ].map(val => this.escapeCsv(val));

      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    this.downloadCsv(csvContent, `user-${this.data.userId || 'unknown'}-login-history.csv`);
  }

  downloadRecentActivityCsv() {
    if (!this.data.recentActivity?.length) return;

    const headers = ['Description', 'Time'];

    const csvRows = [headers.join(',')];

    for (const row of this.data.recentActivity) {
      const values = [
        row.description || '',
        row.timestamp ? new Date(row.timestamp).toLocaleString() : ''
      ].map(val => this.escapeCsv(val));

      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    this.downloadCsv(csvContent, `user-${this.data.userId || 'unknown'}-recent-activity.csv`);
  }

  escapeCsv(value: string): string {
    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  downloadCsv(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    window.URL.revokeObjectURL(url);
  }

  close() {
    this.dialogRef.close();
  }
}
