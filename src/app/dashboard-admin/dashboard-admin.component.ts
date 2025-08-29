import { HttpClient, HttpClientModule } from '@angular/common/http';

import { Component, OnInit, Inject, PLATFORM_ID, AfterViewChecked, ViewChild, ElementRef, ViewEncapsulation, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectorRef, QueryList, ViewChildren, AfterViewInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, NgForm, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ToastrModule } from 'ngx-toastr';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { BrowserModule, DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { UpdateUserDialogComponent } from '../update-user-dialog/update-user-dialog.component';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ReportDetailsDialogComponent } from '../report-details-dialog/report-details-dialog.component';
import { SecurityReportDetailsDialogComponent } from '../security-report-details-dialog/security-report-details-dialog.component';
import { FaqAnswerDialogComponent } from '../faq-answer-dialog/faq-answer-dialog.component';
import { FaqEditDialogComponent } from '../faq-edit-dialog/faq-edit-dialog.component';
import { FaqViewAnswerDialogComponent } from '../faq-view-answer-dialog/faq-view-answer-dialog.component';
export interface SecurityReport {
  userId?: string;
  name?: string;
  email: string;
  description: string;
  steps?: string;
  severity?: string;
  actions?: {
    changePassword?: boolean;
    enable2FA?: boolean;
  };
  createdAt?: string | Date;
  status?: string;   // <-- Add this line
}
interface FaqQuestion {
  _id: string;
  question: string;
  answer?: string;
  createdAt: Date;
  status: 'pending' | 'answered' | 'archived';
  faqType?: 'generalist' | 'cardiologist';
}

export interface UserInfo {
  name: string;
  email: string;
  id?: string;
}


export interface Report {
  _id: string;
  username: UserInfo;  // must be object, NOT string
  reportedDoctor: string;
  reportedDoctorInfo?: UserInfo | null;
  reason: string;
  time: string;
  treated: boolean;
  response?: string;
}



@Component({
  selector: 'app-dashboard-admin',
   standalone: true,
  imports: [MatButtonModule,
    
    CommonModule,
    FormsModule,
    HttpClientModule,
     
    ReactiveFormsModule,
     // <-- Important: call forRoot() here
   
    ToastrModule,
     
    MatDialogModule
  ],
  templateUrl: './dashboard-admin.component.html',
  styleUrl: './dashboard-admin.component.css'
})
export class DashboardAdminComponent implements AfterViewInit {
    activeSection: string = 'dashboard';
  users: any[] = [];
  filteredUsers: any[] = [];
  selectedSpecialty: string = '';
   isLoading= false;
   responseMessage = '';
   statusFilter: string = 'all';  // default can be 'all', 'pending', or 'reviewed'

  // New properties for editing
  user: any = {}; // This will hold the current user being edited
  imagePreview: string | ArrayBuffer | null = null;
  reports: Report[] = [];
  filteredReports: Report[] = [];
  securityReports: SecurityReport[] = [];
 filteredReports_1: SecurityReport[] = [];
 iframeSrc!: SafeResourceUrl;
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
 severityFilter: string = 'all';

  // Filter by status: 'all' | 'pending' | 'reviewed'
  usernameFilter: string = '';
emailFilter: string = '';
faqs: FaqQuestion[] = []; // This should be loaded from backend API
  filteredFaqs: FaqQuestion[] = [];

  questionFilter: string = '';
  statusFilter_3: 'all' | 'pending' | 'answered' = 'all';


  errorMessage = '';
  constructor(private http: HttpClient,private dialog: MatDialog, private router: Router,private sanitizer: DomSanitizer) {}
 ngOnInit(): void {
    const url = 'https://app.powerbi.com/reportEmbed?reportId=3cb75cd6-7558-42c0-b475-00b79db08466&autoAuth=true&ctid=604f1a96-cbe8-43f8-abbf-f8eaf5d85730';
    this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
ngAfterViewInit() {
   
  }

  onManageUsers() {
    console.log('🔘 Manage Users button clicked');
    this.activeSection = 'users';
    this.loadUsers();
  }

 loadUsers() {
    this.isLoading = true;
    this.http.get<any[]>('http://localhost:5000/api/users_crazy').subscribe({
      next: (data) => {
        this.users = data;
        this.filteredUsers = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  filterUsers() {
    if (!this.selectedSpecialty) {
      this.filteredUsers = this.users;
    } else {
      this.filteredUsers = this.users.filter(user =>
        user.specialty.toLowerCase() === this.selectedSpecialty.toLowerCase()
      );
    }
  }
onModify(user: any): void {
  console.log('🛠️ Editing user:', user);

  this.user = { ...user, id: user.id || user._id };
  this.imagePreview = user.photoUrl || user.photo || null;
  this.activeSection = 'profile-settings';
}


onFileChange(event: any): void {
  const file = event.target.files[0];
  console.log('📁 File selected:', file);

  if (file) {
    this.user.photo = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      console.log('🖼️ Image preview ready');
    };
    reader.readAsDataURL(file);
  }
}

submitForm(userForm: NgForm): void {
  console.log('📨 Submitting form...');

  if (userForm.invalid) {
    this.responseMessage = 'Please correct the errors before submitting.';
    console.warn('⚠️ Form is invalid:', userForm);
    return;
  }

  if (!this.user.id) {
    this.responseMessage = 'User ID is missing or invalid!';
    console.error('❌ Missing user ID');
    return;
  }

  this.isLoading = true;
  const formData = new FormData();

  const fieldsToAppend = [
    'name', 'address', 'email', 'mobile',
    'specialty', 'practiceLocation', 'password'
  ];

  for (const field of fieldsToAppend) {
    if (this.user[field]) {
      formData.append(field, this.user[field]);
      console.log(`📦 Appended field: ${field} = ${this.user[field]}`);
    }
  }

  if (this.user.photo instanceof File) {
    formData.append('photo', this.user.photo);
    console.log('📸 Photo appended to formData');
  }

  const userId = this.user.id;

  console.log(`🔄 Sending PUT request to /users/${userId}`);
  this.http.put(`http://localhost:5000/users/${userId}`, formData).subscribe({
    next: (response: any) => {
      this.isLoading = false;
      this.responseMessage = 'User updated successfully.';
      console.log('✅ User updated response:', response);

      const index = this.users.findIndex(u => u.id === userId || u._id === userId);
      if (index !== -1) {
        this.users[index] = { ...this.users[index], ...response.user };
        this.filterUsers(); // reapply filter
        console.log('🔁 User list updated');
      }

      this.activeSection = 'users';
    },
    error: (error) => {
      this.isLoading = false;
      this.responseMessage = 'An error occurred while updating user information.';
      console.error('❌ Error updating user:', error);
    }
  });
}

deleteUser(user: any): void {
this.http.delete(`http://localhost:5000/users/${user._id}`).subscribe({
    next: () => {
      console.log(`${user.name} deleted successfully`);
      this.filteredUsers = this.filteredUsers.filter(u => u._id !== user._id);
    },
    error: (error) => {
      console.error('Failed to delete user:', error);
    }
  });
}



onDelete(user: any): void {
  const dialogRef = this.dialog.open(ConfirmDialogComponent, {
    width: '300px',
    data: { message: `Are you sure you want to delete ${user.name}?` }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      // Proceed with delete
      this.deleteUser(user);
    }
  });}
onToggleSuspend(user: any): void {
  const updatedStatus = !user.isSuspended;
  console.log(`🔄 Toggling suspend status for user ${user.name} (ID: ${user._id}) to: ${updatedStatus}`);

  this.http.put<any>(`http://localhost:5000/users/${user._id}/suspend`, { isSuspended: updatedStatus })
    .subscribe({
      next: (updatedUser) => {
        user.isSuspended = updatedUser.isSuspended;
        console.log(`✅ User ${user.name} suspension status updated successfully to: ${updatedUser.isSuspended}`);
      },
      error: (err) => {
        console.error(`❌ Failed to update suspension status for user ${user.name}`, err);
      }
    });
}

onReport() {
  console.log('🔍 Report section activated');
  this.activeSection = 'reports';
  this.loadReports();
}

usersMap: Record<string, { name: string; email: string }> = {};

// Step 1: Load all users and build the map
async loadUsersMap() {
  try {
    const users = await firstValueFrom(this.http.get<any[]>('http://localhost:5000/api/users_crazy'));
    this.usersMap = {};
    users.forEach(user => {
      this.usersMap[user._id] = { name: user.name, email: user.email };
    });
    console.log('🗂️ Users loaded:', this.usersMap);
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

// Step 2: Lookup user info by ID in the map
fetchUserById(userId: string): Promise<{ name: string; email: string } | null> {
  if (!userId) return Promise.resolve(null);
  return Promise.resolve(this.usersMap[userId] || null);
}

// Step 3: Load reports and enrich with user info
async loadReports(): Promise<void> {
  this.isLoading = true;
  this.errorMessage = '';

  try {
    // Load users first
    await this.loadUsersMap();

    // Fetch reports
    const data = await firstValueFrom(this.http.get<Report[]>('http://localhost:5000/api/reports'));

    const parsedReports = await Promise.all(data.map(async (report) => {
      // Parse report.username safely (your existing logic)
      let usernameObj = { name: 'Unknown', email: '' };
      if (typeof report.username === 'string') {
        try {
          usernameObj = JSON.parse(report.username);
        } catch (e) {
          console.warn('⚠️ Failed to parse username JSON', e);
        }
      } else if (typeof report.username === 'object' && report.username !== null) {
        usernameObj = report.username;
      }

      // Lookup reportedDoctor info in usersMap
      const reportedDoctorInfo = await this.fetchUserById(report.reportedDoctor);

      return {
        ...report,
        username: usernameObj,
        reportedDoctorInfo
      };
    }));

    this.reports = parsedReports;
    this.applyFilters();

  } catch (err) {
    console.error('❌ Failed to load reports:', err);
    this.errorMessage = 'Failed to load reports.';
  } finally {
    this.isLoading = false;
  }
}


applyFilters(): void {
  console.log(`🔄 Applying filters - Status: ${this.statusFilter}, Username: ${this.usernameFilter}, Email: ${this.emailFilter}`);
  
  let filtered = this.reports;

  // Filter by status
  if (this.statusFilter === 'pending') {
    filtered = filtered.filter(r => !r.treated);
    console.log('⚠️ Showing only pending reports');
  } else if (this.statusFilter === 'reviewed') {
    filtered = filtered.filter(r => r.treated);
    console.log('✅ Showing only reviewed reports');
  }

  // Filter by username (case-insensitive substring match on reporter OR reported)
  if (this.usernameFilter && this.usernameFilter.trim() !== '') {
    const usernameLower = this.usernameFilter.trim().toLowerCase();
    filtered = filtered.filter(r => 
      r.username.name.toLowerCase().includes(usernameLower) ||
      (r.reportedDoctorInfo?.name?.toLowerCase().includes(usernameLower))
    );
    console.log(`🔍 Filtering by username (reporter or reported): ${this.usernameFilter}`);
  }

  // Filter by email (case-insensitive substring match on reporter OR reported)
  if (this.emailFilter && this.emailFilter.trim() !== '') {
    const emailLower = this.emailFilter.trim().toLowerCase();
    filtered = filtered.filter(r => 
      r.username.email.toLowerCase().includes(emailLower) ||
      (r.reportedDoctorInfo?.email?.toLowerCase().includes(emailLower))
    );
    console.log(`🔍 Filtering by email (reporter or reported): ${this.emailFilter}`);
  }

  this.filteredReports = filtered;
  this.totalPages = Math.ceil(this.filteredReports.length / this.pageSize);
  this.currentPage = 1;

  console.log(`📊 Filtered Reports Count: ${this.filteredReports.length}`);
  console.log(`📄 Total Pages: ${this.totalPages}`);
}


goToPage(page: number) {
  if (page < 1 || page > this.totalPages) return;
  console.log(`📁 Navigating to page ${page}`);
  this.currentPage = page;
}

viewDetails(report: Report) {
  this.dialog.open(ReportDetailsDialogComponent, {
    width: '520px',
    data: report
  });
}


get pagedReports(): Report[] {
  const start = (this.currentPage - 1) * this.pageSize;
  return this.filteredReports.slice(start, start + this.pageSize);
}

respondToReport(report: Report) {
  const dialogRef = this.dialog.open(UpdateUserDialogComponent, {
    width: '600px',
    data: { report }  // Optional, if you want to pass report info to dialog
  });

  dialogRef.afterClosed().subscribe(response => {
    if (response && response.trim()) {
      this.isLoading = true;
      this.http.post(`http://localhost:5000/api/reports/${report._id}/respond`, { response })
        .subscribe({
          next: () => {
            this.isLoading = false;
            alert('Response sent successfully.');
            this.loadReports();
          },
          error: (err) => {
            this.isLoading = false;
            console.error('Failed to send response:', err);
            alert('Failed to send response.');
          }
        });
    }
  });
}
onSecurityReport(){
  this.activeSection='securityreports';
   this.loadSecurityReports();
}

loadSecurityReports() {
  this.http.get<any[]>('http://localhost:5000/api/security-reports').subscribe({
    next: (reports) => {
      this.securityReports = reports;
      this.filteredReports = reports;
      this.applyFilters_1();
    },
    error: (err) => {
      console.error('Failed to load security reports', err);
    }
  });
}

applyFilters_1() {
  this.filteredReports_1 = this.securityReports.filter(report => {
    const matchesUsername =
      !this.usernameFilter ||
      (report.name &&
        report.name.toLowerCase().includes(this.usernameFilter.toLowerCase()));

    const matchesEmail =
      !this.emailFilter ||
      (report.email &&
        report.email.toLowerCase().includes(this.emailFilter.toLowerCase()));

    const matchesSeverity =
      this.severityFilter === 'all' ||
      (report.severity &&
        report.severity.toLowerCase() === this.severityFilter.toLowerCase());

    const matchesStatus =
      this.statusFilter === 'all' ||
      ((report.status ? report.status.toLowerCase() : 'pending') ===
        this.statusFilter.toLowerCase());

    return matchesUsername && matchesEmail && matchesSeverity && matchesStatus;
  });
}


hasActions(actions: any): boolean {
  return actions?.changePassword || actions?.enable2FA || false;
}

viewReportDetails(report: any) {
  const userId = report.userId; // make sure 'userId' exists in your report object

  this.http.get<any>(`http://localhost:5000/api/users/${userId}/details`).subscribe({
    next: (userDetails) => {
      // Merge the original report with the extra fetched data
      const reportWithDetails = {
        ...report,
        recentActivity: userDetails.recentActivity,
        loginHistory: userDetails.loginHistory
      };

      this.dialog.open(SecurityReportDetailsDialogComponent, {
        width: '520px',
        data: reportWithDetails,
      });
    },
    error: (err) => {
      console.error('Failed to load user details', err);
      // fallback to opening the dialog with only the base report
      this.dialog.open(SecurityReportDetailsDialogComponent, {
        width: '520px',
        data: report,
      });
    }
  });
}
markReportValid(report: any) {
  console.log('Marking report valid for ID:', report._id);

  // Step 1: Update report status
  this.http.post(`http://localhost:5000/api/security-reports/${report._id}/status`, { status: 'valid' }).subscribe({
    next: () => {
      // Step 2: Send notification email
      const notification = {
        subject: 'Security Concern Confirmed',
        message: `Dear user,

We have confirmed your security concern. You have been logged out from all devices. Please change your password and enable 2FA for enhanced security.

Best regards,
MedConnect Team`
      };
      this.http.post(`http://localhost:5000/api/users/${report.userId}/send-security-notification`, notification).subscribe({
        next: () => alert('Report marked valid and notification sent.'),
        error: () => alert('Failed to send notification email.')
      });
    },
    error: () => alert('Failed to update report status.')
  });
}


markReportInvalid(report: any) {
  console.log('Marking report invalid for ID:', report._id);

  // Step 1: Update report status
  this.http.post(`http://localhost:5000/api/security-reports/${report._id}/status`, { status: 'invalid' }).subscribe({
    next: () => {
      // Step 2: Send notification email
      const notification = {
        subject: 'Security Concern Reviewed',
        message: `Dear user,

We have reviewed your reported security concern, and after a thorough investigation, everything appears to be in order. No suspicious activity was detected.

If you notice any unusual activity in the future, please contact us immediately.

Best regards,
MedConnect Team`
      };
      this.http.post(`http://localhost:5000/api/users/${report.userId}/send-security-notification`, notification).subscribe({
        next: () => alert('Report marked invalid and notification sent.'),
        error: () => alert('Failed to send notification email.')
      });
    },
    error: () => alert('Failed to update report status.')
  });
}


  forceLogout(report: any) {
    const userId = report.userId;
    const reason = report.reason || 'No reason provided';

    this.http.post(`http://localhost:5000/admin/force-logout/${userId}`, { reason }).subscribe({
      next: (res) => {
        console.log('Force logout successful', res);
        alert('User has been logged out from all devices.');
      },
      error: (err) => {
        console.error('Force logout failed', err);
        alert('Failed to force logout user.');
      }
    });
  }
onFAQMangement() {
  this.activeSection = 'FAQ';
  console.log('Switched to FAQ section');
  // Fetch the FAQ list from your backend API
  this.loadFaqs();

  // Initialize filteredFaqs (if needed)
  // console.log('Initialize filteredFaqs'); // Optional
}

loadFaqs() {
  console.log('Loading FAQs from backend...');
  const generalPractitionerFaqs$ = this.http.get<FaqQuestion[]>('http://localhost:5000/api/faqs_5');
  const cardiologistFaqs$ = this.http.get<FaqQuestion[]>('http://localhost:5000/api/faqs_3');

  forkJoin([generalPractitionerFaqs$, cardiologistFaqs$]).subscribe({
    next: ([generalFaqs, cardioFaqs]) => {
      console.log('Generalist FAQs fetched:', generalFaqs);
      console.log('Cardiologist FAQs fetched:', cardioFaqs);

      // Tag each FAQ with its source
      const taggedGeneralFaqs = generalFaqs.map(faq => ({ ...faq, faqType: 'generalist' as 'generalist' }));
      const taggedCardioFaqs = cardioFaqs.map(faq => ({ ...faq, faqType: 'cardiologist' as 'cardiologist' }));

      // Combine both arrays
      let combinedFaqs = [...taggedGeneralFaqs, ...taggedCardioFaqs];

      // Pre-filter FAQs depending on active section
      if (this.activeSection === 'archive') {
        combinedFaqs = combinedFaqs.filter(faq => (faq.status || '').trim().toLowerCase() === 'archived');
      }

      this.faqs = combinedFaqs;
      console.log('Combined FAQs after pre-filter:', this.faqs);

      // Apply appropriate filters
      if (this.activeSection === 'archive') {
        this.applyFilters_3();
      } else {
        this.applyFilters_2();
      }

      console.log('Filters applied to FAQs');
    },
    error: (err) => {
      console.error('Failed to fetch FAQs:', err);
    }
  });
}

typeFilter = 'all';

applyFilters_2() {
  this.filteredFaqs = this.faqs.filter((faq) => {
    const matchesQuestion = (faq.question || '')
      .toLowerCase()
      .includes((this.questionFilter || '').toLowerCase());

    const matchesStatus =
      this.statusFilter === 'all' ||
      (faq.status || '').toLowerCase() === (this.statusFilter || '').toLowerCase();

    const matchesType =
      this.typeFilter === 'all' ||
      (faq.faqType || '').toLowerCase() === (this.typeFilter || '').toLowerCase();

    const isNotArchived = (faq.status || '').toLowerCase() !== 'archived';

    return matchesQuestion && matchesStatus && matchesType && isNotArchived;
  });
}
goToArchive(){
  this.activeSection='archive';
  this.applyFilters_3()
}


seeAnswer(faq: FaqQuestion) {
  const dialogRef = this.dialog.open(FaqViewAnswerDialogComponent, {
    data: faq,
    width: '520px',
  });

  dialogRef.afterClosed().subscribe(() => {
    // Optional: do something after dialog closes if needed
  });
}


answerFaq(faq: FaqQuestion) {
  const dialogRef = this.dialog.open(FaqAnswerDialogComponent, {
    data: faq,
    width: '520px'
  });

  dialogRef.afterClosed().subscribe((answer: string | null) => {
    if (answer !== null) {
      faq.answer = answer;
      faq.status = 'answered';
      this.applyFilters_2();

     this.http.put(`http://localhost:5000/api/faqs/${faq._id}`, { answer: answer, status: 'answered' }).subscribe({
        next: () => console.log('FAQ updated'),
        error: (err) => console.error('Failed to update FAQ', err)
      });
    }
  });
}



archiveFaq(faq: FaqQuestion) {
  faq.status = 'archived';
  this.applyFilters_2();
  console.log('Archived FAQ:', faq);

  this.http.put(`http://localhost:5000/api/faqs/${faq._id}`, { status: 'archived' }).subscribe({
    next: () => console.log('FAQ archived successfully'),
    error: (err) => {
      console.error('Failed to archive FAQ', err);
      alert('Failed to archive FAQ. Please try again later.');
    }
  });
}

editFaq(faq: FaqQuestion) {
  const dialogRef = this.dialog.open(FaqEditDialogComponent, {
    data: faq,
    width: '520px',
  });

  dialogRef.afterClosed().subscribe((answer: string | null) => {
    if (answer !== null) {
      faq.answer = answer;
      faq.status = 'answered';
      this.applyFilters_2();

      this.http.put(`http://localhost:5000/api/faqs/${faq._id}`, { answer, status: 'answered' }).subscribe({
        next: () => console.log('FAQ updated'),
        error: (err) => console.error('Failed to update FAQ', err)
      });
    }
  });
}


deleteFaq(faq: FaqQuestion) {
  const dialogRef = this.dialog.open(ConfirmDialogComponent, {
    width: '300px',
    data: { message: `Are you sure you want to delete this FAQ?` }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      this.http.delete(`http://localhost:5000/api/faqs/${faq._id}`).subscribe({
        next: () => {
          this.faqs = this.faqs.filter(item => item._id !== faq._id);
          this.applyFilters_2();
          console.log('Deleted FAQ:', faq);
        },
        error: (err) => {
          console.error('Failed to delete FAQ:', err);
          alert('Failed to delete FAQ. Please try again later.');
        }
      });
    }
  });
}
applyFilters_3() {
  this.filteredFaqs = this.faqs.filter(faq => {
    const status = (faq.status || '').trim().toLowerCase();
    if (status !== 'archived') return false;  // <== exclude non-archived

    const matchesQuestion = (faq.question || '')
      .toLowerCase()
      .includes((this.questionFilter || '').toLowerCase());

    const matchesType =
      this.typeFilter === 'all' ||
      (faq.faqType || '').toLowerCase() === (this.typeFilter || '').toLowerCase();

    return matchesQuestion && matchesType;
  });
}


onUnarchive(faq: FaqQuestion) {
  // Change status back to 'pending' when unarchiving
  faq.status = 'pending';

  this.http.put(`http://localhost:5000/api/faqs/${faq._id}`, { status: faq.status }).subscribe({
    next: () => {
      console.log(`FAQ unarchived and set to pending: ${faq.question}`);

      // Refresh filtered list based on current section
      if (this.activeSection === 'archive') {
        this.applyFilters_3();
      } else {
        this.applyFilters_2();
      }
    },
    error: (err) => {
      console.error('Failed to unarchive FAQ', err);
      alert('Failed to unarchive FAQ. Please try again later.');

      // Revert status if update fails
      faq.status = 'archived';
    }
  });
}
onLogout() {
  this.router.navigate(['/login']);
}
onDashboard(){
  this.activeSection='dashboard'}

}