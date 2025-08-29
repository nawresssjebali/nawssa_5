import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';

@Component({
  selector: 'app-enable2fa',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    FullCalendarModule
  ],
  templateUrl: './enable2fa.component.html',
  styleUrl: './enable2fa.component.css'
})
export class Enable2faComponent {
  user: any;
  qrCodeImage: string | null = null;     // ⬅️ allow null
  secretKey: string = '';
  userToken: string = '';
  userId: string = '';
  errorMessage: string | null = null;    // ⬅️ allow null
  successMessage: string | null = null;  // ⬅️ allow null
  is2FAEnabled: boolean = false;
  isLoading: boolean = false;

  constructor(private http: HttpClient, private router: Router) {
    const user = localStorage.getItem('user');
    if (user) {
      this.userId = JSON.parse(user)?.id || '';
    }
  }

 ngOnInit(): void {
  this.user = JSON.parse(localStorage.getItem('user') || '{}');

  // ✅ First: check if 2FA is already enabled
  this.http.post<any>('http://localhost:5000/api/2fa/status', {
    userId: this.user.id
  }).subscribe({
    next: (res) => {
      this.is2FAEnabled = res.enabled; // backend should return { enabled: true/false }

      if (!this.is2FAEnabled) {
        // ✅ Only generate QR code if 2FA is not enabled yet
        this.http.post<any>('http://localhost:5000/api/2fa/generate-secret', {
          userId: this.user.id
        }).subscribe({
          next: (res) => {
            this.qrCodeImage = res.qrCodeUrl;
            this.secretKey = res.secret;
            console.log('✅ 2FA Secret generated:', this.secretKey);
          },
          error: (err) => {
            console.error('❌ Error generating secret:', err);
          }
        });
      }
    },
    error: (err) => {
      console.error('❌ Error checking 2FA status:', err);
    }
  });
}


  verify2FA(): void {
    this.errorMessage = null;
    this.successMessage = null;
    this.isLoading = true;

    const serverTimeUTC = new Date().toISOString();
    console.log('Server time (UTC):', serverTimeUTC);

    const serverTimeTunisia = new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' });
    console.log('Server time (Tunisia):', serverTimeTunisia);

    if (!this.userToken || this.userToken.length !== 6) {
      this.errorMessage = 'Veuillez entrer un code à 6 chiffres valide.';
      this.isLoading = false;
      return;
    }

    this.http.post<any>('http://localhost:5000/api/2fa/verify-token', {
      userId: this.user.id,
      token: this.userToken
    }).subscribe({
      next: (res) => {
        if (res.valid) {
          this.successMessage = 'Authentification à deux facteurs activée avec succès !';
          localStorage.removeItem('secretKey');
          this.is2FAEnabled = true;
        } else {
          this.errorMessage = 'Code invalide, veuillez réessayer.';
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors de la vérification :', err);
        this.errorMessage = 'Erreur lors de la vérification. Veuillez réessayer plus tard.';
        this.isLoading = false;
      }
    });
  }

  disable2FA(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.http.post('http://localhost:5000/api/2fa/disable', { userId: this.userId }).subscribe({
      next: (res: any) => {
        this.successMessage = res.message;
        this.is2FAEnabled = false;
        this.qrCodeImage = null; // ⬅️ this now works
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Une erreur est survenue.';
      },
      complete: () => {
        this.isLoading = false;
      }
    });
    this.router.navigate(['/dashboard-medecin-generaliste'], {
      queryParams: { activeSection: 'securityReport' }
    });
  
  }

  goBack(): void {
   const user = JSON.parse(localStorage.getItem('user') || '{}');
  console.log('User from localStorage:', user);

  const specialty = user?.specialty?.toLowerCase();
  console.log('Detected specialty:', specialty);

  if (specialty === 'cardiologie') {
    console.log('Navigating to cardiologue dashboard');
    this.router.navigate(['/dashboard-medecin-cardiologue'], { queryParams: { activeSection: 'securityReport' } });
  } else {
    console.log('Navigating to generaliste dashboard');
    this.router.navigate(['/dashboard-medecin-generaliste'], { queryParams: { activeSection: 'securityReport' } });
  }
  }
}
