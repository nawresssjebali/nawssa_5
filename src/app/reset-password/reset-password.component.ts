import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  token: string | null = null;
  newPassword: string = '';
  confirmPassword: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('🔧 ResetPasswordComponent initialized.');
    this.route.paramMap.subscribe(params => {
      this.token = params.get('token');
      console.log('🔑 Received token:', this.token);
    });
  }

  // Function to log errors to the backend
  logErrorToBackend(logMessage: string): void {
    console.log('📤 Logging error to backend:', logMessage);
    this.http.post('http://localhost:5000/log-error', { message: logMessage })
      .subscribe({
        next: () => console.log('✅ Error successfully logged to backend'),
        error: err => console.error('❌ Failed to log error to backend:', err)
      });
  }

onResetPassword(form: NgForm): void {
  console.log('🔁 Form submitted!');

  if (form.invalid) {
    console.log('⚠️ Form is invalid.');
    return;
  }

  console.log('Form Valid:', form.valid); // This should print "true" if form is valid
  console.log('New Password:', this.newPassword);
  console.log('Confirm Password:', this.confirmPassword);

  // Clear previous messages at the start
  this.errorMessage = '';
  this.successMessage = '';

  // Check if the passwords match
  if (this.newPassword !== this.confirmPassword) {
    this.errorMessage = 'Passwords do not match.';
    this.successMessage = ''; // Clear success message
    console.warn('⚠️ Passwords do not match');
    this.logErrorToBackend('Password mismatch attempt during reset.');
    return;
  }

  if (!this.token) {
    this.errorMessage = 'Invalid or missing reset token.';
    this.successMessage = ''; // Clear success message
    console.error('❌ No token found.');
    this.logErrorToBackend('No reset token provided.');
    return;
  }

  const payload = {
    token: this.token,
    password: this.newPassword
  };

  console.log('📡 Sending password reset request with payload:', payload);

  this.http.post('http://localhost:5000/reset-password', payload)
    .subscribe({
      next: (response: any) => {
        console.log('📥 Response from server:', response);
        if (response.success) {
          this.successMessage = 'Password has been successfully reset!';
          this.errorMessage = '';  // Clear error message
          console.log('✅ Password reset successful!');
          setTimeout(() => {
            console.log('➡️ Redirecting to login page...');
            this.router.navigate(['/login']);
          }, 5000);
        } else {
          this.errorMessage = response.message || 'An error occurred while resetting your password.';
          this.successMessage = '';  // Clear success message
          console.warn('⚠️ Server responded with an error:', this.errorMessage);
          this.logErrorToBackend(this.errorMessage);
        }
      },
      error: (error) => {
        console.error('❌ Error resetting password:', error);
        this.errorMessage = 'An error occurred while resetting your password. Please try again.';
        this.successMessage = ''; // Clear success message
        this.logErrorToBackend(`Reset password API failed: ${JSON.stringify(error)}`);
      }
    });
}
}
