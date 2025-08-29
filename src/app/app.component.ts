import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { FormsModule } from '@angular/forms';
import { AuthService } from './services/auth.service';  // Adjust path as needed

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'projet_pfe_nawress_jebali';

  constructor(private authService: AuthService, private router: Router) {}

ngOnInit() {
  const user = this.authService.getUser();
  if (user) {
    this.authService.connectSocket(user.id);
    this.authService.onForceLogout().subscribe(({ reason }) => {
      alert(`You have been logged out: ${reason || 'No reason provided'}`);
      this.authService.logout();
      this.router.navigate(['/login']);
    });
  } else {
    console.log('No logged user found at ngOnInit');
  }
}
}
