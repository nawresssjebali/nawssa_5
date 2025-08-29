import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import { Router } from '@angular/router';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent {
  currentPassword: string = '';
  newPassword: string = '';

  errorMessage: string = '';
  successMessage: string = '';


 constructor(
    private http: HttpClient,
    private router: Router   // <-- inject Router here
  ) {}  // ✅ Fixed parenthesis here

  onResetPassword(form: NgForm) {
    this.errorMessage = '';
    this.successMessage = '';

    if (!form.valid) {
      this.errorMessage = 'Please fill in all required fields.';
      return;
    }

    // Retrieve user ID from localStorage
    const user = localStorage.getItem('user');
    let userId = '';
    if (user) {
      try {
        userId = JSON.parse(user)?.id || '';
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
        this.errorMessage = 'User information is corrupted. Please log in again.';
        return;
      }
    } else {
      this.errorMessage = 'User not logged in.';
      return;
    }

    if (!userId) {
      this.errorMessage = 'Invalid user ID. Please log in again.';
      return;
    }

    if (this.currentPassword === this.newPassword) {
      this.errorMessage = 'New password must be different from current password.';
      return;
    }

    // Prepare payload
    const payload = {
      userId: userId,
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
    };

    // Send request to backend
    this.http.post<{ success: boolean; message?: string }>('http://localhost:5000/api/change-password', payload)

    
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Password updated successfully!';
            form.resetForm();
          } else {
            this.errorMessage = response.message || 'Current password is incorrect.';
          }
        },
        error: (error) => {
          this.errorMessage = 'An error occurred. Please try again later.';
          console.error(error);
        }
      });
  }

goBack() {
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
