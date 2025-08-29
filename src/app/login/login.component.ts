import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule,],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  passwordVisible = false;
  loginData = { email: '', password: '' };
  responseMessage: string = '';
  isLoading: boolean = false;

  // 2FA
  show2FAVerification = false;
  userIdFor2FA = '';
  twoFAToken = '';

  private apiUrl = 'http://localhost:5000/login';
  private verify2FAUrl = 'http://localhost:5000/api/2fa/verify-login-token';

  constructor(private router: Router, private http: HttpClient,private chatService: ChatService,
  private authService: AuthService ) {}

  ngOnInit() {
    console.log('Login component initialized');
  }

  togglePassword() {
    this.passwordVisible = !this.passwordVisible;
    console.log('Password visibility toggled:', this.passwordVisible);
  }

  goToRegister() {
    this.router.navigate(['/register']);
    console.log('Navigated to the Register page');
  }

  submitLoginForm() {
    this.responseMessage = ''; // reset messages
    console.log('Login form submitted:', this.loginData);

    if (this.loginData.email && this.loginData.password) {
      this.isLoading = true;
      this.authenticateDoctor(this.loginData);
    } else {
      this.responseMessage = 'Please fill in both fields';
      console.error(this.responseMessage);
    }
  }

authenticateDoctor(loginData: any) {
  this.http.post(this.apiUrl, loginData).subscribe(
    (response: any) => {
      this.isLoading = false;
      console.log('Response from server:', response);

      if (response.twoFactorRequired && response.userId) {
        this.show2FAVerification = true;
        this.userIdFor2FA = response.userId;
        this.responseMessage = 'Entrez votre code 2FA.';
        console.log('2FA required, waiting for token input');
      } else if (response.user) {
        // Use AuthService to handle login logic, socket connection, and force logout subscription
        this.authService.login(response.user);

        // Redirect user after login
        this.redirectUser(response.user);
      } else {
        this.responseMessage = response.message || 'Login failed. Please check your credentials.';
        alert(this.responseMessage);
        console.error('Login failed:', this.responseMessage);
      }
    },
    (error) => {
      this.isLoading = false;
      if (error.status === 403) {
        this.responseMessage = 'Your account has been suspended. Please contact support.';
      } else if (error.status === 401) {
        this.responseMessage = 'Incorrect email or password. Please try again.';
      } else if (error.status === 404) {
        this.responseMessage = 'User not found. Please register first.';
      } else if (error.status === 500) {
        this.responseMessage = 'Internal server error. Please try again later.';
      } else {
        this.responseMessage = 'An unexpected error occurred. Please try again.';
      }
      alert(this.responseMessage);
      console.error('Error during login request:', error);
    }
  );
}


  verify2FAToken() {
    if (!this.twoFAToken) {
      this.responseMessage = 'Veuillez entrer le code 2FA.';
      return;
    }
    this.responseMessage = '';
    this.isLoading = true;

    this.http.post(this.verify2FAUrl, {
      userId: this.userIdFor2FA,
      token: this.twoFAToken
    }).subscribe(
      (res: any) => {
        this.isLoading = false;
        // Adjusted: your backend returns user on success (no valid flag)
        if (res.user) {
          localStorage.setItem('user', JSON.stringify(res.user));
          this.redirectUser(res.user);
        } else {
          this.responseMessage = res.message || 'Code 2FA invalide.';
          alert(this.responseMessage);
          console.error('Invalid 2FA token response:', res);
        }
      },
      (err) => {
        this.isLoading = false;
        this.responseMessage = 'Erreur lors de la vérification du code 2FA.';
        alert(this.responseMessage);
        console.error('2FA verification error:', err);
      }
    );
  }

  redirectUser(user: any): void {
  const email = user.email?.toLowerCase()?.trim();
  const role = user.role?.toLowerCase()?.trim();
  const specialty = user.specialty?.toLowerCase()?.trim();

  if (!email || !user) {
    this.responseMessage = 'User data is incomplete or missing.';
    console.error(this.responseMessage);
    return;
  }

  // ✅ Admin check by email or role
  if (email === 'admin@ecg.tn' || role === 'admin') {
    this.router.navigate(['/dashboard-admin']);
    return;
  }

  // ✅ Redirect by specialty
  switch (specialty) {
    case 'generaliste':
      this.router.navigate(['/dashboard-medecin-generaliste']);
      break;
    case 'cardiologie':
      this.router.navigate(['/dashboard-medecin-cardiologue']);
      break;
    default:
      this.responseMessage = 'Specialty not recognized.';
      console.error(this.responseMessage);
      alert(this.responseMessage);
  }
}

  goToForgetPassword() {
    this.router.navigate(['/forget-me']);
    console.log('Navigated to Forget Password page');
  }
}
