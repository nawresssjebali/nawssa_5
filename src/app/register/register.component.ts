import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule,HttpClientModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  user = {
    name: '',
    address: '',
    email: '',
    mobile: '',
    specialty: '',
    practiceLocation: '',
    password: '',
    photo: null as File | null,
  };

  responseMessage: string = '';  // For feedback after form submission
  isLoading: boolean = false;  // To indicate if the form is submitting
  imagePreview: string | ArrayBuffer | null = null;  // For image preview

  constructor(private http: HttpClient,private router: Router) {}

  // Handle photo file input change and show preview
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input?.files?.[0]) {
      this.user.photo = input.files[0];  // Assign the selected file to user object

      // Preview the image
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result;  // Set image preview
      };
      reader.readAsDataURL(this.user.photo);  // Read the file
    }
  }

  // Form submission logic
  submitForm(userForm: NgForm) {
    if (userForm.invalid) {
      this.responseMessage = 'Please fill in all the required fields.';
      return;
    }

    if (this.user.photo) {
      this.isLoading = true;  // Set loading state
      const formData = new FormData();
      formData.append('name', this.user.name);
      formData.append('address', this.user.address);
      formData.append('email', this.user.email);
      formData.append('mobile', this.user.mobile);
      formData.append('specialty', this.user.specialty);
      formData.append('practiceLocation', this.user.practiceLocation);
      formData.append('password', this.user.password);
      formData.append('photo', this.user.photo);

      // HTTP POST request to submit the form data
      this.http.post('http://localhost:5000/users', formData).subscribe(
        (response) => {
          console.log('Form submitted successfully', response);
          this.responseMessage = 'User registered successfully!';  // Success feedback
          userForm.resetForm();  // Reset form after success
          this.imagePreview = null;  // Clear the image preview

          // Add a delay before redirecting to the login page
          setTimeout(() => {
            this.router.navigate(['/login']);  // Navigate to login page
          }, 2000); // Delay of 2 seconds
        },
        (error) => {
          console.error('Form submission error', error);
          this.responseMessage = 'Form submission failed. Please try again.';  // Error feedback
        }
      ).add(() => {
        this.isLoading = false;  // Reset loading state
      });
    }
  }
}