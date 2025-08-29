import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule, HttpErrorResponse } from '@angular/common/http'; // Import HttpClient
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-forget-me',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './forget-me.component.html',
  styleUrls: ['./forget-me.component.css']
})
export class ForgetMeComponent {
  // Correctly binding loginData to the form fields using ngModel
  loginData = { email: '', password: '' };

  constructor(private router: Router, private http: HttpClient) {}

  // Navigate to the login page when Cancel is clicked
  goToForgetPassword() {
    this.router.navigate(['/login']); // Navigate to the login page
    console.log('Navigated to login Password page');
  }

  // Handle the 'Search' button click event
  onSearchEmail() {
    const email = (document.getElementById('email') as HTMLInputElement).value;

    if (!email) {
      alert('Please enter an email address.');
      return;
    }

    // Send the email to the backend (ensure the URL is correct)
    this.http.post('http://localhost:5000/send-email', { email }) // Ensure correct backend URL
      .subscribe(
        (data: any) => {
          // Handle the successful response from the backend
          if (data.success) {
            alert('Email sent successfully!');
          } else {
            alert('Failed to send email: ' + data.message);
          }
        },
        (error: HttpErrorResponse) => {
          console.error('HttpErrorResponse:', error);
          alert('An error occurred: ' + error.message);
        }
      );
  }

  // Handle login when 'Connexion' button is clicked
  onLoginClick() {
    if (!this.loginData.email || !this.loginData.password) {
      alert('Please enter both email and password.');
      return;
    }
    this.authenticateDoctor(this.loginData);
  }

  // Authenticate doctor with provided login data
  authenticateDoctor(loginData: any) {
    console.log('Sending request to authenticate doctor with data:', loginData);

    const apiUrl = 'http://localhost:5000/login';  // Replace with your API URL

    // Send the POST request to the backend to authenticate the user
    this.http.post(apiUrl, loginData).subscribe(
      (response: any) => {
        console.log('Response from server:', response);

        // Check if user data is received in the response
        if (response?.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
          console.log('User data saved to localStorage:', response.user);

          // Redirect based on specialty
          const user = response.user;
          const specialty = user.specialty.trim().toLowerCase();

          if (specialty === 'generaliste') {
            this.router.navigate(['/dashboard-medecin-generaliste']);
            console.log('Navigating to generaliste dashboard');
          } else if (specialty === 'cardiologie') {
            this.router.navigate(['/dashboard-medecin-cardiologue']);
            console.log('Navigating to cardiologue dashboard');
          } else {
            alert('Specialty not recognized');
            console.error('Specialty not recognized:', specialty);
          }
        } else {
          alert('Login failed. Incorrect email or password.');
          console.error('Login failed:', response?.message || 'Invalid credentials');
        }
      },
      (error: HttpErrorResponse) => {
        console.error('Error during login request:', error);
        if (error.status === 401) {
          alert('Incorrect email or password.');
        } else if (error.status === 404) {
          alert('User not found.');
        } else {
          alert('An unexpected error occurred.');
        }
      }
    );
  }
}
