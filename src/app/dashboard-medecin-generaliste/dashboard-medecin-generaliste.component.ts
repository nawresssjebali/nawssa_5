import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Component, OnInit, Inject, ElementRef, ViewChild, AfterViewChecked, ChangeDetectorRef, ViewChildren, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, NgForm, ReactiveFormsModule, Validators } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import jsPDF from 'jspdf';
import interactionPlugin from '@fullcalendar/interaction';
import {ViewEncapsulation } from '@angular/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { FullCalendarModule } from '@fullcalendar/angular'; 
import { DateSelectArg } from '@fullcalendar/core';
import moment from 'moment-timezone';
import {QueryList} from '@angular/core';



import { toZonedTime } from 'date-fns-tz';


import { forkJoin, Subject ,Observable, Subscription} from 'rxjs';

interface CalendarBookingEvent {
   _id?: string;
  title: string;
  date: Date;
  roomId: string;
   participantIds?: string[];      // array of user IDs related to the event
  participants?: string[];        // (optional) participant names for template use
  
  userId?: string;
  doctorId?: string;
    cancelled?: string; 
  participantNames?: string[];
}
interface Case {
  _id: string;
  patientId: string;
  patientAge: number;
  patientSex: string;
  consultationMotive: string;
  answer: string;
  updatedAt: string;
  generalistDecision?: string; 
   responseText?: string;
   answered?: string;
  
  responseFileName?: string;//
  
}
interface Message {
  _id?:string;
  origin?: string;
  senderId: string;
  receiverId: string;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
   showOrigin?: boolean; 
  options?: { label: string; value: string }[]; 
  file?: {
    url: string;
    name: string;
    size?: number;
    type?: string;  // file MIME type like 'audio/webm' or 'application/pdf'
  };
  // Frontend only UI control properties for audio messages:
  isPlaying?: boolean;   // Whether audio is currently playing
   senderName?: string; 
   progress?: number;        // For progress bar % width
  currentTime?: number;     // Current playback time (seconds)
  duration?: number; 
   edited?: boolean  
type?: 'text' | 'file' | 'voice' | 'voice_call' | 'video_call';

  callStatus?: 'made' | 'answered' | 'missed' | 'rejected' | 'ended'; // ✅ added 'made' and 'ended'
  startTime?: number;   // optional timestamp when call started
  endTime?: number;     // optional timestamp when call ended
  formattedDuration?: string; 
}
interface ChatbotResponse {
  answer: string;
  origin?: string;
}
export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'ECG' | 'Case';  // Capitalized to match MongoDB values
  refId: string;
  createdAt: string;
}



interface ECG {
  filePath: string;
  emergencyLeve: string;
  uploadDate: Date;
  answer: string;
   generalistDecision?: string; 
}

import {
  CalendarEvent,
  CalendarView,
  CalendarWeekViewComponent,
} from 'angular-calendar';
import { CalendarOptions } from '@fullcalendar/core/index.js';
import { ChatService } from '../services/chat.service';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';



@Component({
  selector: 'app-dashboard-medecin-generaliste',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    HttpClientModule, 
    MatSnackBarModule, 
    ReactiveFormsModule,

    FullCalendarModule,
   
    ToastrModule

  ],
  templateUrl: './dashboard-medecin-generaliste.component.html',
  styleUrls: ['./dashboard-medecin-generaliste.component.css'],
  encapsulation: ViewEncapsulation.None ,// Corrected: Added a comma here
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DashboardMedecinGeneralisteComponent implements OnInit, AfterViewChecked {
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteAudio') remoteAudioRef!: ElementRef<HTMLAudioElement>;
  @ViewChild('chatBox') chatBox!: ElementRef;
  @ViewChildren('audioRef') audioRefs!: QueryList<ElementRef<HTMLAudioElement>>;

    result: string | null = null;
     result1: string | null = null;
  loading: boolean = false;
  user: any;
  incomingCallerUserId: string | null = null; 
  isLoadingDoctors: boolean = false;
  generalDoctors: any[] = [];
  selectedFile: File | null = null;
  selectedDoctorId: string | null = null;  // <== Add this if it doesn't exist
  userDrafts: any[] = [];
  cases: Case[] = [];
  question: string = '';
clinicalCase: string = '';
caseData: any = {};
  isRecording = false;
mediaRecorder: MediaRecorder | null = null;
audioChunks: BlobPart[] = [];
selectedAudioFile: File | null = null;
audioPreviewUrl: string | null = null;
toastMessage: string | null = null;
isScreenSharing = false;
screenStream: MediaStream | null = null;
toastTimeout: any = null;
  callId: string | null = null;
  showAccountMenu = false;
  incomingOffer: RTCSessionDescriptionInit | null = null;
  incomingCallerSocketId: string | null = null;
  conversations: { [doctorId: string]: Message[] } = {};
 chatHistorySubscription: Subscription | null = null;
  doctors: any[] = []; 
  stars: number[] = [1, 2, 3, 4, 5]; // Define an array of stars for rating
isTyping = false;
typingTimeout: ReturnType<typeof setTimeout> | null = null;
  doctorPhotoUrl: string | null = null;
  choices: string[] = [''];
  activeSection: string = 'oath'; // <<< NEW - manage active content dynamically
  drafts: any[] = [];
 callType: 'voice' | 'video' | null = null;
 
  imagePreview: string | null = null;
  readonly BASE_URL = 'http://localhost:5000';// or your actual backend URL
 // or your actual backend URL
  unreadCounts: { [doctorId: string]: number } = {};
  callStatus: 'idle' | 'ringing' | 'connected' | 'ended' = 'idle';
 
callerSocketId?: string;
  isLoading: boolean = false;
  responseMessage: string | null = null;
  selectedMode: 'question' | 'case' | null = null;
  activeDoctor: string = ''; // Active doctor name
  selectedFile_5!: File;
  result_1: string = '';
  isBrowser: boolean;
  selectedFile_1: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  isFileSelected = false;
  uploadMessage = '';
   chatbotConversation: Message[] = [];
  newMessage: string = '';
  expandedCases: { [caseId: string]: boolean } = {};
  botId = 'medical_bot'; 
 speechRecognition: any;
 isListening = false;
  myName: string = ''; // your own name
  startTime: number | null = null;
  caseQuestions = [
  "Quel est l’âge du patient ?",
  "Quel est le sexe du patient ?",
  "Quel est le motif principal de consultation ?",
  "Depuis combien de temps le symptôme persiste-t-il ?",
  "Y a-t-il des antécédents médicaux pertinents ?",
  "Y a-t-il des facteurs de risque ? (ex. : tabagisme, hypertension)",
  "Y a-t-il des symptômes associés ? (ex. : irradiation de la douleur thoracique, dyspnée)",
  "Quels examens ont été réalisés ? (ex. : NFS, radiographie, ECG)"
];

caseKeys = [
  'age',
  'sexe',
  'motifPrincipal',
  'duree',
  'antecedents',
  'facteursRisque',
  'symptomesAssocies',
  'examens' // clé combinée
];

currentCaseStep = -1;
  ecgs: any[] = [];
  all_ecgs: any[] = [];
  diagnosesChoices: string[] = [''];
  // Valeurs par défaut des réglages
  brightness: number = 1;
  contrast: number = 1;
  chatbotMessage: string = '';
  blur: number = 0;
  cropX: number = 0;
  cropY: number = 0;
  cropWidth: number = 300;
  cropHeight: number = 300;
  events: CalendarBookingEvent[] = [];
  patientId: string = '';
  patientAge: number | null = null;
  patientSex: string = '';
  consultationMotive: string = '';
  gradcamImage: string | null = null;  // URL for Grad-CAM image
  gradcamVisible: boolean = false; 
  symptoms: string = '';
   // Default emergency level
  all_cases: any[] = [];
  hoveredMessage: number | null = null;
openMenuIndex: number | null = null;

editingMessage: number | null = null;
editMessageContent: string = '';
  // Medical Details
  medicalHistory: string = '';
  allergies: string = '';
  currentMedications: string = '';
  bloodPressure: string = '';
  heartRate: number | null = null;
  temperature: number | null = null;
  oxygenSaturation: number | null = null;
  securityReportForm!: FormGroup;
  submissionSuccess = false;
  isMuted = false;
  selectedECGFile: File | null = null;
  caseSubmissionMessage: string = '';
  ecgFileInvalid: boolean = false;
   notifications: Notification[] = [];
  calendarPlugins = [dayGridPlugin]; 
  allReports: any[] = [];
  selectedReportResponse: string | null = null;
typingUsers: Set<string> = new Set();
selectedFile2!: File;
callerName: string | null = null;
  calendarEvents: { title: string; start: string; end: string; allDay: boolean }[] = [];
callTimeout: ReturnType<typeof setTimeout> | null = null;
peerConnection: RTCPeerConnection | null = null;
localStream: MediaStream | null = null;
remoteStream: MediaStream = new MediaStream();
isCalling: boolean = false;

 // set from your chat logic
  userId!: string;

  iceServersConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
   caseFiles: { [caseId: string]: File } = {};
caseDataFinal: { [key: string]: string } = {}; 
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin], // ✅ include interactionPlugin
    initialView: 'dayGridMonth',
    selectable: true, // ✅ allow date selection
    select: (selectInfo: DateSelectArg) => {
      if (this.selectedDoctorId) {
        this.handleDateSelect(selectInfo, this.selectedDoctorId);
      } else {
        this.snackBar.open('Please select a doctor before choosing a date.', 'Close', {
          duration: 3000,
        });
      }
    
    
    
    
    }, // ✅ Use select handler with the required arguments
    events: this.calendarEvents,
  };
 
  
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdRef: ChangeDetectorRef,
    private ngZone: NgZone ,
    private cd: ChangeDetectorRef,
    private toast: ToastrService,
    private router: Router,
    private http: HttpClient,
    private snackBar: MatSnackBar,
      private route: ActivatedRoute,
    private fb: FormBuilder,
    private chatService: ChatService,
    private cdr: ChangeDetectorRef // <-- Ajoutez ceci
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
ngOnInit(): void {
  // --- Query params ---
  this.route.queryParams.subscribe(params => {
    if (params['activeSection']) {
      this.activeSection = params['activeSection'];
    }
  });

  this.isBrowser = isPlatformBrowser(this.platformId);

  // --- Security Report Form ---
  this.securityReportForm = this.fb.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    description: ['', Validators.required],
    steps: [''],
    severity: [''],
    actions: this.fb.group({
      changePassword: [false],
      enable2FA: [false],
      avoidSharing: [false],
      contactSupport: [false],
      monitorActivity: [false]
    })
  });

  const savedReport = localStorage.getItem('savedSecurityReportForm');
  if (savedReport) {
    try {
      const parsed = JSON.parse(savedReport);
      this.securityReportForm.patchValue(parsed);
      console.log('✅ Restored saved security report form');
    } catch (e) {
      console.warn('⚠️ Failed to parse saved form data', e);
    }
  }

  // --- Browser checks ---
  if (this.isBrowser) {
    const userData = localStorage.getItem('user');
    (window as any).showReminderNotification = this.showReminderNotification.bind(this);
    console.log('✅ Notification function bound to window');

    if (userData) {
      try {
        this.user = JSON.parse(userData);

        // --- Notifications ---
        console.log('Checking notification permission...');
        if (Notification.permission !== 'granted') {
          Notification.requestPermission().then(permission => {
            console.log('Notification permission result:', permission);
          });
        } else {
          console.log('Notification already granted:', Notification.permission);
        }
        console.log('Notification permission check done.');

        // --- Init App Data ---
        this.loadDoctorPhoto();
        this.fetchRespondedCases();
        this.fetchDrafts();
        this.fetchNotifications();
        this.generateTimeSlots();
        this.loadAvailability();

        if (!this.conversations) {
          this.conversations = {};
        }

        const savedConversations = localStorage.getItem('conversations');
        if (savedConversations) {
          this.conversations = JSON.parse(savedConversations);
          if (this.patchMissingFileTypes) {
            this.patchMissingFileTypes();
          }
        }

        // --- Chat Service ---
        this.chatService.connect(this.user.id);
        (window as any).chatService = this.chatService;
        console.log('ChatService set on window');

        if (this.selectedDoctorId) {
          this.chatService.joinRoom(this.selectedDoctorId);
        }

        this.chatService.onTyping().subscribe(({ senderId }) => {
          if (senderId !== this.user.id) {
            this.typingUsers.add(senderId);
          }
        });

        this.chatService.onStopTyping().subscribe(({ senderId }) => {
          if (senderId !== this.user.id) {
            this.typingUsers.delete(senderId);
          }
        });

        this.chatService.onMessagesRead().subscribe((data) => {
          console.log('✅ messagesRead event received:', data);

          const readerId = data.by;
          let updatedCount = 0;

          for (const roomId in this.conversations) {
            this.conversations[roomId].forEach((msg: any) => {
              if (
                msg.receiverId === readerId &&
                msg.senderId !== readerId &&
                msg.status !== 'read'
              ) {
                msg.status = 'read';
                updatedCount++;
              }
            });
          }

          console.log(`Total messages updated to 'read': ${updatedCount}`);
          localStorage.setItem('conversations', JSON.stringify(this.conversations));
          this.cdRef.detectChanges();
        });

        this.chatService.receiveMessages().subscribe((message: any) => {
          console.log('🔔 Received message:', message);

          if (message.file && !message.file.type && message.file.name?.endsWith('.webm')) {
            message.file.type = 'audio/webm';
          }

          const room = message.senderId === this.user.id
            ? message.receiverId
            : message.senderId;

          if (!this.conversations[room]) {
            this.conversations[room] = [];
          }

          const existing = this.conversations[room].find(
            m => m.timestamp === message.timestamp && m.senderId === message.senderId
          );

          if (existing) {
            existing.status = message.status;
          } else {
            this.conversations[room].push(message);
          }

          if (message.receiverId === this.user.id && message.senderId !== this.user.id) {
            this.showNotification(message);
          }

          localStorage.setItem('conversations', JSON.stringify(this.conversations));

        });

        // --- WebRTC signaling (calls) ---
        this.chatService.onCallMade().subscribe(async (data) => {
          const { offer, socketId, callerName, callerUserId, callType } = data;
          await this.handleIncomingCall(
            offer,
            socketId,
            callerUserId,
            callerName || 'Doctor',
            callType || 'voice'
          );
        });

        this.chatService.onAnswerMade().subscribe(async ({ answer, socketId }) => {
          if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            if (this.callTimeout) {
              clearTimeout(this.callTimeout);
              this.callTimeout = null;
            }
            this.callStatus = 'connected';
            this.isCalling = false;
          }
        });

        this.chatService.onIceCandidate().subscribe(async ({ candidate, socketId }) => {
          if (this.peerConnection && candidate) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('Error adding ICE candidate', err);
            }
          }
        });

        this.chatService.onCallRejected().subscribe(({ socketId }) => {
          console.log(`❌ Call rejected by ${socketId}`);
          this.cleanupCall();
        });

        this.chatService.onCallEnded().subscribe(({ socketId }) => {
          console.log(`📴 Call ended by ${socketId}`);
          this.cleanupCall();
        });

        this.chatService.onCallCanceled().subscribe(({ socketId }) => {
          console.log(`🚫 Call canceled by ${socketId}`);
          this.cleanupCall();
        });

        this.chatService.onCallAccepted().subscribe(({ socketId }) => {
          console.log('✅ Call accepted by', socketId);
          this.isCalling = false;
          this.callStatus = 'connected';
        });

        this.chatService.listenToCallReminders(
          (msg) => {
            this.showReminderNotification('📅 Reminder', msg);
          },
          (msg, opts) => {
            this.showReminderNotification('⏰ Call Alert', msg, opts?.sound);
          }
        );

        // --- Calendar ---
        const storedEvents = localStorage.getItem('calendarEvents');
        if (storedEvents) {
          this.calendarEvents = JSON.parse(storedEvents);
          this.normalizeEvents(this.calendarEvents);
          this.calendarOptions.events = this.calendarEvents;
          this.checkTodayEvents(this.calendarEvents);
        } else {
          this.http.get(`http://localhost:5000/events?userId=${this.user.id}`).subscribe({
            next: (response: any) => {
              this.calendarEvents = response.events;
              this.normalizeEvents(this.calendarEvents);
              this.calendarOptions.events = this.calendarEvents;
              localStorage.setItem('calendarEvents', JSON.stringify(this.calendarEvents));
              this.checkTodayEvents(this.calendarEvents);
            },
            error: (error) => {
              console.error('Error fetching events:', error);
            }
          });
        }

        window.addEventListener('storage', (event) => {
          if (event.key === 'user' && event.newValue === null) {
            console.warn('Detected logout from another browser/tab. Redirecting...');
            this.router.navigate(['/login']);
          }
        });

      } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
      }

      // --- Speech Recognition (outside try/catch) ---
      const { webkitSpeechRecognition }: any = window as any;
      if (webkitSpeechRecognition) {
        this.speechRecognition = new webkitSpeechRecognition();

        const browserLang = navigator.language || 'fr-FR';
        const supportedLangs = ['fr-FR', 'en-US'];
        this.speechRecognition.lang = supportedLangs.includes(browserLang) ? browserLang : 'fr-FR';

        this.speechRecognition.interimResults = false;
        this.speechRecognition.maxAlternatives = 1;

        this.speechRecognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          this.ngZone.run(() => {
            this.chatbotMessage = transcript;
            this.sendChatbotMessage();
            this.isListening = false;
          });
        };

        this.speechRecognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          this.ngZone.run(() => (this.isListening = false));
        };

        this.speechRecognition.onend = () => {
          this.ngZone.run(() => (this.isListening = false));
        };
      } else {
        console.warn('Speech recognition not supported in this browser.');
      }

    } else {
      console.warn('No user data found in localStorage.');
    }
  } else {
    console.warn('Not running in browser context.');
  }
}


showReminderNotification(title: string, message: string, sound: boolean = true) {
  console.log(`🔔 Showing notification: ${title} - ${message}`);

  if (sound) {
    const audio = new Audio('/assets/notif.mp3');
    audio.play().catch(err => console.warn('🔇 Sound error:', err));
  }

  // 💡 REMOVE visibility check for testing
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body: `${message} • ${new Date().toLocaleTimeString()}`,
      icon: '/assets/chat.png'
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}
ngAfterViewInit(): void {
  console.log('📺 Video/audio elements initialized:');
  console.log('Local video element:', this.localVideoRef?.nativeElement);
  console.log('Remote video element:', this.remoteVideoRef?.nativeElement);
  
  if (this.localVideoRef?.nativeElement && this.localStream) {
    this.localVideoRef.nativeElement.srcObject = this.localStream;
    this.localVideoRef.nativeElement.muted = true;
  }

  if (this.remoteVideoRef?.nativeElement && this.remoteStream) {
    this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;
  }
}

muteMic() {
  if (!this.localStream) return;

  this.localStream.getAudioTracks().forEach(track => track.enabled = false);
  this.isMuted = true;
}

unmuteMic() {
  if (!this.localStream) return;

  this.localStream.getAudioTracks().forEach(track => track.enabled = true);
  this.isMuted = false;
}

async makeCall(targetSocketId: string, type: 'voice' | 'video' = 'voice') {
  console.log(`📞 makeCall called with type: ${type}, target:`, targetSocketId);

  try {
    this.callType = type;
    await this.cdRef.detectChanges();

    const constraints = type === 'video' ? { audio: true, video: true } : { audio: true };
    console.log('🎯 Requesting local media with constraints:', constraints);
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

    this.localStream.getTracks().forEach(track => {
      console.log(`✅ Local track acquired: kind=${track.kind}, state=${track.readyState}, enabled=${track.enabled}`);
    });

    if (type === 'video' && this.localVideoRef?.nativeElement) {
      console.log('🎬 Attaching local video (caller side)...');
      const videoEl = this.localVideoRef.nativeElement;
      videoEl.srcObject = this.localStream;
      videoEl.muted = true;
      videoEl.autoplay = true;
      videoEl.playsInline = true;

      videoEl.onloadedmetadata = () => {
        console.log('🖼️ Local video metadata loaded, attempting to play...');
        videoEl.play()
          .then(() => console.log('✅ Local video playing'))
          .catch(err => console.error('❌ Local video play failed:', err));
      };
    }

    console.log('🔧 Setting up peer connection...');
    this.setupPeerConnection(targetSocketId);
    this.callId = targetSocketId;

    if (!this.peerConnection) {
      console.error('❌ Peer connection not initialized!');
      return;
    }
    console.log('🔹 Peer connection ready:', this.peerConnection);

    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
      console.log(`🔹 Local track added to PeerConnection: ${track.kind}`, track);
    });

    if (!this.remoteStream) this.remoteStream = new MediaStream();
    if (type === 'video' && this.remoteVideoRef?.nativeElement) {
      this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;
    }
    if (type === 'voice' && this.remoteAudioRef?.nativeElement) {
      this.remoteAudioRef.nativeElement.srcObject = this.remoteStream;
      this.remoteAudioRef.nativeElement.muted = false;
    }

    this.peerConnection.ontrack = (event) => {
      console.log('📡 Remote track received:', event.track.kind);
      this.remoteStream.addTrack(event.track);
      console.log(`➕ Remote track added: ${event.track.kind}`);
    };

    const offer = await this.peerConnection.createOffer();
    console.log('📄 Offer created:', offer);
    await this.peerConnection.setLocalDescription(offer);
    console.log('✅ Local description set');
this.chatService.callUser(
  targetSocketId,
  offer,
  this.user.name || 'Doctor', // caller name
  this.user.id,               // callerUserId
  type                        // call type
);

    console.log('📤 Offer sent to target:', targetSocketId);

    this.isCalling = true;

    // 🆕 Save call record immediately when initiating
    this.addCallRecord({
      senderId: this.user.id,        // adjust depending on your user model
      receiverId: targetSocketId,     // for now using socketId, later map to userId
      type: type === 'video' ? 'video_call' : 'voice_call',
      callStatus: 'made',
      duration: 0                     // will be updated on hangup
    }).subscribe({
      next: res => console.log('📜 Call record saved:', res),
      error: err => console.error('❌ Failed to save call record:', err)
    });

this.callTimeout = setTimeout(() => {
  console.warn('⏰ Call timed out - no answer');
  this.chatService.cancelCall(targetSocketId);
  this.stopRingtone();
  this.rejectCall();
  this.callStatus = 'idle';
  this.isCalling = false;

  // ✅ Update call record to "missed"
  this.updateCallRecord({
    senderId: this.user.id,
    receiverId: targetSocketId,
    callStatus: 'missed',
    endTime: Date.now(),
    duration: 0
  }).subscribe({
    next: res => console.log('📞 Call record updated to missed:', res),
    error: err => console.error('❌ Failed to update missed call record:', err)
  });
}, 30000);


  } catch (err) {
    console.error('❌ Error making call:', err);
  }
}



upPeerConnection(targetSocketId: string) {
  this.peerConnection = new RTCPeerConnection(this.iceServersConfig);

  this.peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      this.chatService.sendIceCandidate(targetSocketId, event.candidate);
    }
  };

  // Unified track handling
  this.peerConnection.ontrack = (event) => {
    if (!this.remoteStream) this.remoteStream = new MediaStream();
    event.streams[0].getTracks().forEach(track => this.remoteStream!.addTrack(track));

    if (event.track.kind === 'video' && this.remoteVideoRef?.nativeElement) {
      this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;
    } else if (event.track.kind === 'audio' && this.remoteAudioRef?.nativeElement) {
      this.remoteAudioRef.nativeElement.srcObject = this.remoteStream;
      this.remoteAudioRef.nativeElement.muted = false;
      this.remoteAudioRef.nativeElement.play().catch(() => {});
    }
  };
}
setupPeerConnection(targetSocketId: string) {
  console.log('🚀 Starting setupPeerConnection with targetSocketId:', targetSocketId);

  this.peerConnection = new RTCPeerConnection(this.iceServersConfig);
  console.log('🛠️ RTCPeerConnection created:', this.peerConnection);

  // ICE candidate handler
  this.peerConnection.onicecandidate = (event) => {
    console.log('💡 onicecandidate event fired:', event);
    if (event.candidate) {
      console.log('🔹 ICE candidate generated:', event.candidate);
      console.log('📤 Sending ICE candidate to targetSocketId:', targetSocketId);
      this.chatService.sendIceCandidate(targetSocketId, event.candidate);
    } else {
      console.log('⚠️ ICE candidate event: no candidate (end of candidates)');
    }
  };

  // Track handler for both audio & video
  this.peerConnection.ontrack = (event) => {
    console.log('📥 ontrack event fired:', event);
    console.log('📌 Track kind:', event.track.kind);
    console.log('📌 Track id:', event.track.id);
    console.log('📌 Number of streams in event:', event.streams?.length);

    // Ensure remoteStream exists
    if (!this.remoteStream) {
      console.log('⚡ Initializing remoteStream...');
      this.remoteStream = new MediaStream();
      console.log('✅ remoteStream initialized:', this.remoteStream);
    }

    // Add track to remoteStream
    this.remoteStream.addTrack(event.track);
    console.log(`➕ Remote track added to remoteStream: ${event.track.kind}`, event.track);

    // Video element
    if (event.track.kind === 'video') {
      if (this.remoteVideoRef?.nativeElement) {
        console.log('🎥 Attaching remote video to ViewChild element...');
        this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;
        this.remoteVideoRef.nativeElement.play()
          .then(() => console.log('✅ Remote video playing'))
          .catch(err => console.error('❌ Remote video play error:', err));
        console.log('🎬 Remote video element properties:', {
          srcObject: this.remoteVideoRef.nativeElement.srcObject,
          paused: this.remoteVideoRef.nativeElement.paused,
          autoplay: this.remoteVideoRef.nativeElement.autoplay
        });
      } else {
        console.warn('⚠️ remoteVideoRef is not available!');
      }
    }

    // Audio element
    if (event.track.kind === 'audio') {
      if (this.remoteAudioRef?.nativeElement) {
        console.log('🔊 Attaching remote audio to ViewChild element...');
        this.remoteAudioRef.nativeElement.srcObject = this.remoteStream;
        this.remoteAudioRef.nativeElement.muted = false;
        this.remoteAudioRef.nativeElement.play()
          .then(() => console.log('✅ Remote audio playing'))
          .catch(err => console.error('❌ Remote audio play error:', err));
        console.log('🎧 Remote audio element properties:', {
          srcObject: this.remoteAudioRef.nativeElement.srcObject,
          muted: this.remoteAudioRef.nativeElement.muted,
          paused: this.remoteAudioRef.nativeElement.paused
        });
      } else {
        console.warn('⚠️ remoteAudioRef is not available!');
      }
    }

    console.log('📌 Current remoteStream tracks:', this.remoteStream.getTracks());
  };

  console.log('✅ setupPeerConnection finished for targetSocketId:', targetSocketId);
}

addCallRecord(call: {
    senderId: string,
    receiverId: string,
    type: 'voice_call' | 'video_call',
    callStatus: 'made' | 'received' | 'missed',
    duration?: number
  }): Observable<any> {
    return this.http.post('http://localhost:5000/api/chat/addCall', call);
  }

async handleIncomingCall(
  offer: RTCSessionDescriptionInit,
  callerSocketId: string,
  callerUserId: string,
  callerName: string,
  type: 'voice' | 'video' = 'voice'
) {
  console.log(`📞 Incoming ${type} call from:`, callerSocketId, 'Name:', callerName, 'UserId:', callerUserId);
  // Store values for UI
  this.callType = type;
  this.incomingOffer = offer;
  this.incomingCallerSocketId = callerSocketId;
  this.callerName = callerName;   // ✅ store caller name dynamically
  this.incomingCallerUserId = callerUserId;

  this.callId = callerSocketId;
  this.callStatus = 'ringing';
  this.playRingtone();

  // 🎥 Video call: prepare local & remote streams
  if (type === 'video') {
    try {
      const constraints = { video: true, audio: true };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.localVideoRef?.nativeElement) {
        this.localVideoRef.nativeElement.srcObject = this.localStream;
      }

      this.remoteStream = new MediaStream();
      if (this.remoteVideoRef?.nativeElement) {
        this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;
      }

      console.log("✅ Local preview ready for incoming video call");
    } catch (err) {
      console.error("❌ Error accessing local media for incoming video call", err);
    }
  }

  // 🎤 Voice call: only prepare local mic
  if (type === 'voice') {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("✅ Local mic ready for incoming voice call");
    } catch (err) {
      console.error("❌ Error accessing mic for incoming voice call", err);
    }
  }
}
async acceptCall() {
  console.log(`📞 Accepting ${this.callType || 'voice'} call`);
  this.stopRingtone();

  if (!this.incomingOffer || !this.incomingCallerSocketId) {
    console.error('❌ No incoming call offer or caller ID saved');
    return;
  }

  try {
    const constraints = this.callType === 'video' ? { audio: true, video: true } : { audio: true };
    console.log('🎯 Requesting media with constraints:', constraints);
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ Local stream acquired:', this.localStream);

    // Attach local video with maximum logging
    if (this.callType === 'video' && this.localVideoRef?.nativeElement) {
      const videoEl = this.localVideoRef.nativeElement;
      console.log('🎬 Attaching local video stream to element...');
      videoEl.srcObject = this.localStream;
      videoEl.muted = true;
      videoEl.autoplay = true;
      videoEl.playsInline = true;

      console.log('📌 Local video element properties:', {
        muted: videoEl.muted,
        autoplay: videoEl.autoplay,
        playsInline: videoEl.playsInline,
        srcObject: videoEl.srcObject
      });

      videoEl.onloadedmetadata = () => {
        console.log('🖼️ Local video metadata loaded, attempting to play...');
        videoEl.play()
          .then(() => console.log('✅ Local video playing'))
          .catch(err => console.error('❌ Local video play failed:', err));
      };

      console.log('⏳ Waiting for metadata to load...');
    } else {
      console.warn('⚠️ Local video element not found or call type is not video');
    }

    console.log('🔧 Setting up peer connection...');
    this.setupPeerConnection(this.incomingCallerSocketId);

    if (!this.peerConnection) {
      console.error('❌ Peer connection not initialized!');
      return;
    }
    console.log('🔹 Peer connection initialized:', this.peerConnection);

    // Add local tracks
    this.localStream.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
      console.log(`✅ Local track added: ${track.kind}`, track);
    });

    // Unified remote stream
    if (!this.remoteStream) this.remoteStream = new MediaStream();
    console.log('📺 Remote stream initialized:', this.remoteStream);

    // Set the ontrack handler ONCE
    this.peerConnection.ontrack = (event) => {
      console.log('📥 ontrack event fired:', event);
      if (!event.streams || !event.streams[0]) {
        console.warn('⚠️ No streams in ontrack event');
        return;
      }

      event.streams[0].getTracks().forEach(track => {
        this.remoteStream?.addTrack(track);
        console.log('🔹 Remote track added:', track.kind, track);
      });

      // Video element
      if (this.remoteVideoRef?.nativeElement && this.callType === 'video') {
        this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;
        this.remoteVideoRef.nativeElement.play().catch(err => console.warn('❌ Remote video play error:', err));
        console.log('🎥 Remote video attached to element:', this.remoteVideoRef.nativeElement);
      }

      // Audio element
      if (this.remoteAudioRef?.nativeElement && this.callType === 'voice') {
        this.remoteAudioRef.nativeElement.srcObject = this.remoteStream;
        this.remoteAudioRef.nativeElement.muted = false;
        this.remoteAudioRef.nativeElement.play().catch(err => console.warn('❌ Remote audio play error:', err));
        console.log('🔊 Remote audio attached to element:', this.remoteAudioRef.nativeElement);
      }
    };

    console.log('📌 Setting remote description...');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.incomingOffer));
    console.log('✅ Remote description set');

    const answer = await this.peerConnection.createAnswer();
    console.log('📜 Answer created:', answer);

    await this.peerConnection.setLocalDescription(answer);
    console.log('✅ Local description set');

    if (this.callType) {
      this.chatService.makeAnswer(this.incomingCallerSocketId, answer, this.callType);
    } else {
      this.chatService.makeAnswer(this.incomingCallerSocketId, answer, 'voice'); // default to 'voice' if needed
    }

    console.log('📤 Answer sent to caller');

    this.callId = this.incomingCallerSocketId;
    this.callStatus = 'connected';

    const startTime = Date.now();
    this.startTime = Date.now();

console.log('📌 Call record data:', {
  senderId: this.incomingCallerUserId!,
  receiverId: this.user.id,
  callStatus: 'answered',
  startTime
});




    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }

    console.log(`📞 ${this.callType || 'Voice'} call connected successfully`);
  } catch (err) {
    console.error('❌ Error accepting incoming call:', err);
  }
}
updateCallRecord(callUpdate: {
  senderId: string;
  receiverId: string;
  callStatus: 'answered' | 'missed' | 'made' | 'rejected';
  startTime?: number;
  endTime?: number;
  duration?: number;
}): Observable<Message> {   // <-- specify the return type
  return this.http.put<Message>(
    `http://localhost:5000/api/chat/updateCall`,
    callUpdate
  );
}



rejectCall() {
  console.log('❌ Call rejected');
  this.stopRingtone();

  if (this.incomingCallerSocketId) {
    this.chatService.rejectCall('', this.incomingCallerSocketId);
    console.log('📤 rejectCall emitted with socketId:', this.incomingCallerSocketId);
  } else {
    console.warn('⚠️ No incomingCallerSocketId found to notify caller.');
  }

  // Record rejection in call history
  const startTime = Date.now(); // time of rejection
  if (this.incomingCallerUserId) {
    this.updateCallRecord({
      senderId: this.incomingCallerUserId!,
      receiverId: this.user.id,
      callStatus: 'rejected',
      startTime
    }).subscribe({
      next: res => console.log('📜 Call record updated to rejected:', res),
      error: err => console.error('❌ Failed to update call record:', err)
    });
  }

  // Cleanup media
  if (this.peerConnection) {
    this.peerConnection.close();
    this.peerConnection = null;
    console.log('🔌 Peer connection closed on reject');
  }

  if (this.localStream) {
    this.localStream.getTracks().forEach(track => track.stop());
    this.localStream = null;
    console.log('🎙️ Local media tracks stopped on reject');
  }

  if (this.remoteStream) {
    this.remoteStream.getTracks().forEach(track => track.stop());
    this.remoteStream = new MediaStream();
    console.log('📺 Remote video tracks cleared on reject');
  }

  // Clear UI & timeout
  this.callId = null;
  this.callStatus = 'idle';
  this.isCalling = false;
  this.callType = null; 

  if (this.callTimeout) {
    clearTimeout(this.callTimeout);
    this.callTimeout = null;
    console.log('⏱️ Call timeout cleared on reject');
  }

  this.callerName = null;

  console.log('✅ Call state reset to idle after rejection.');
}

private ringtoneAudio: HTMLAudioElement | null = null;

playRingtone() {
  if (!this.ringtoneAudio) {
    this.ringtoneAudio = document.getElementById('incomingRingtone') as HTMLAudioElement;
  }

  if (this.ringtoneAudio && this.ringtoneAudio.paused) {
    this.ringtoneAudio.currentTime = 0;
    this.ringtoneAudio.loop = true;

    this.ringtoneAudio.play().then(() => {
      console.log('🔊 Ringtone playing...');
    }).catch((err) => {
      console.warn('🔇 Ringtone play error:', err);
    });
  }
}


stopRingtone() {
  if (this.ringtoneAudio && !this.ringtoneAudio.paused) {
    this.ringtoneAudio.pause();
    this.ringtoneAudio.currentTime = 0;
    console.log('🔕 Ringtone stopped');
  }
}

cancelCall() {
  if (this.callId) {
    this.chatService.cancelCall(this.callId);
    console.log('🚫 Caller canceled the call:', this.callId);
  }

  // Cleanup
  if (this.peerConnection) {
    this.peerConnection.close();
    this.peerConnection = null;
  }

  if (this.localStream) {
    this.localStream.getTracks().forEach(track => track.stop());
    this.localStream = null;
  }

  if (this.remoteStream) {
    this.remoteStream.getTracks().forEach(track => track.stop());
    this.remoteStream = new MediaStream();
  }

  this.callId = null;
  this.callType = null; 
  this.isCalling = false;
  this.callStatus = 'idle';
  this.stopRingtone();
}

toggleAccountMenu() {
  this.showAccountMenu = !this.showAccountMenu;
  console.log('🔄 showAccountMenu:', this.showAccountMenu);
}

hangUp() {
  const targetSocketId = this.callId || this.incomingCallerSocketId;

  // 1️⃣ Notify the other user via socket hangUp
  if (targetSocketId) {
    this.chatService.hangUp(targetSocketId, this.callType || 'voice');
    console.log('✅ Notified other user of hangup:', targetSocketId);
  }

  // 2️⃣ Clean up local/remote streams and peer connection
  this.cleanupCall();

  // 3️⃣ Compute call duration and determine status
  const endTime = Date.now();
  const duration = this.startTime ? Math.floor((endTime - this.startTime) / 1000) : 0;
  const wasAnswered = this.callStatus === 'connected' && this.startTime != null;

  // 4️⃣ Update the call message locally in the conversation
  const roomId = this.incomingCallerUserId || this.callId;
  if (roomId && this.conversations[roomId]?.length) {
    const callMessageIndex = this.conversations[roomId].findIndex(
      m => m.type === 'voice_call' || m.type === 'video_call'
    );

    if (callMessageIndex !== -1) {
      const updatedCallMessage = { ...this.conversations[roomId][callMessageIndex] };

      updatedCallMessage.callStatus = wasAnswered ? 'made' : 'answered';
      updatedCallMessage.duration = duration;
      updatedCallMessage.endTime = endTime;

      this.conversations[roomId][callMessageIndex] = updatedCallMessage;
      this.conversations[roomId] = [...this.conversations[roomId]];

      console.log('📩 Call message updated locally:', updatedCallMessage);
    }
  }

  // 5️⃣ Update call record in backend
  const senderId = this.incomingCallerUserId || this.user.id;
  const receiverId = this.user.id === senderId ? this.callId! : this.user.id;

 this.updateCallRecord({
  senderId,
  receiverId,
  callStatus: wasAnswered ? 'made' : 'answered',
  startTime: this.startTime ?? undefined, // <-- converts null to undefined
  endTime,
  duration
})
.subscribe({
    next: res => {
      console.log('📞 Call record updated on hangup:', res);

      // Update message in conversation if backend returns updated object
      if (res && roomId) {
        const index = this.conversations[roomId].findIndex(m => m._id === res._id);
        if (index !== -1) {
          this.conversations[roomId][index] = res;
          this.conversations[roomId] = [...this.conversations[roomId]];
        }
      }
    },
    error: err => console.error('❌ Failed to update call record on hangup:', err)
  });

  // 6️⃣ Reset call state
  this.startTime = null;
  this.callStatus = 'ended';
  this.callId = null;
  this.incomingCallerSocketId = null;
  this.incomingCallerUserId = null;
}


private cleanupCall() {
  // Stop local & remote tracks
  [this.localStream, this.remoteStream].forEach(stream => {
    if (stream) stream.getTracks().forEach(track => track.stop());
  });

  // Clear video/audio elements
  if (this.localVideoRef?.nativeElement) this.localVideoRef.nativeElement.srcObject = null;
  if (this.remoteVideoRef?.nativeElement) this.remoteVideoRef.nativeElement.srcObject = null;
  if (this.remoteAudioRef?.nativeElement) this.remoteAudioRef.nativeElement.srcObject = null;

  // Close peer connection
  if (this.peerConnection) {
    this.peerConnection.close();
    this.peerConnection = null;
  }

  // Reset streams
  this.localStream = null;
 
this.remoteStream = new MediaStream();


  // Reset call state
  this.callId = null;
  this.callType = null;
  this.callStatus = 'idle';
  this.isCalling = false;
  this.callerName = null;

  if (this.callTimeout) {
    clearTimeout(this.callTimeout);
    this.callTimeout = null;
  }
}

// Add this private method in your component class (outside ngOnInit)
private patchMissingFileTypes() {
  Object.values(this.conversations).forEach((messages: Message[]) => {
    messages.forEach(msg => {
      if (msg.file && !msg.file.type && msg.file.name?.endsWith('.webm')) {
        msg.file.type = 'audio/webm';
      }
    });
  });

  // 🔁 Save patched conversations back
  localStorage.setItem('conversations', JSON.stringify(this.conversations));
}



normalizeEvents(events: any[]): void {
  events.forEach(event => {
    // Check if event has 'start' and 'end' or just 'date'
    if (event.start && event.end) {
      // If the event has a 'start' and 'end' date, use it
      event.date = event.start;
    } else if (!event.date) {
      // If the event has neither 'date', 'start' nor 'end', mark it as an invalid event
      event.date = null;
    }
  });
}
  
  
      // Listen for logout in other tabs
      
  
  loadDoctorPhoto(): void {
    if (!this.user?.photo) {
      console.error('Photo data is missing, cannot load photo.');
      return;
    }

    const savedPhotoUrl = localStorage.getItem('doctorPhotoUrl');
    if (savedPhotoUrl) {
      this.doctorPhotoUrl = savedPhotoUrl;
      console.log('Loaded photo URL from localStorage:', this.doctorPhotoUrl);
    } else {
      const photoUrl = `http://localhost:5000${this.user.photo}`;
      this.doctorPhotoUrl = photoUrl;
      localStorage.setItem('doctorPhotoUrl', this.doctorPhotoUrl);
      console.log('Generated and saved photo URL:', this.doctorPhotoUrl);
    }
  }

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.user.photo = file;

      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
submitForm(userForm: NgForm) {
  // Step 1: Check if the form is valid
  if (userForm.invalid) {
    this.responseMessage = 'Please correct the errors before submitting.';
    return;
  }

  // Step 2: Ensure user has an ID
  if (!this.user.id) {
    this.responseMessage = 'User ID is missing or invalid!';
    return;
  }

  this.isLoading = true;
  const formData = new FormData();

  // Step 3: Dynamically append only the provided fields
  if (this.user.name) formData.append('name', this.user.name);
  if (this.user.address) formData.append('address', this.user.address);
  if (this.user.email) formData.append('email', this.user.email);
  if (this.user.mobile) formData.append('mobile', this.user.mobile);
  if (this.user.specialty) formData.append('specialty', this.user.specialty);
  if (this.user.practiceLocation) formData.append('practiceLocation', this.user.practiceLocation);
  if (this.user.password) formData.append('password', this.user.password);

  // Step 4: Add photo only if it's a valid File object
  if (this.user.photo && this.user.photo instanceof File) {
    formData.append('photo', this.user.photo);
  }

  const userId = this.user.id; // ✅ Save ID before the request

  // Step 5: Send the PUT request with the form data
  this.http.put(`http://localhost:5000/users/${userId}`, formData).subscribe({
    next: (response: any) => {
      this.isLoading = false;
      this.responseMessage = 'User updated successfully';

      if (response?.user) {
        // ✅ Merge the new data and restore the ID
        this.user = { ...this.user, ...response.user, id: userId };
        localStorage.setItem('user', JSON.stringify(this.user));
        console.log('Updated user stored successfully');
      }
    },
    error: (error) => {
      this.isLoading = false;
      this.responseMessage = 'An error occurred while updating user information.';
      console.error('Error updating user:', error);
    }
  });
}


  // Sidebar Actions

  onShowProfileSettings() {
    console.log('Switching to profile-settings section');
    this.activeSection = 'profile-settings';
  }

  onDeleteAccount() {
    console.log('Switching to delete account section');
    this.activeSection = 'delete';
  }

  onLogout() {
    console.log('Logging out...');
    // Optional: handle logout functionality
    localStorage.clear();
    console.log('Cleared localStorage');
    this.router.navigate(['/login']); // or wherever your login page is
  }

  confirmDelete() {
    console.log('Confirming account deletion...');
    this.activeSection = 'goodbye'; // After confirming delete
    console.log('Switched to goodbye section');

    // Show goodbye message for a while, then delete the account
    setTimeout(() => {
      this.deleteAccount().then(() => {
        this.logout();
      }).catch((error) => {
        console.error('Error during account deletion:', error);
      });
    }, 3000); // Delay of 3 seconds
  }

  // Method to delete the account
  deleteAccount(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Simulate a backend API call to delete the account
      this.http.delete(`http://localhost:5000/users/${this.user.id}`).subscribe(
        (response: any) => {
          console.log('Account deleted successfully');
          resolve();
        },
        error => {
          console.error('Failed to delete account', error);
          reject(error);
        }
      );
    });
  }

  // Method to log the user out after deletion
  logout() {
    console.log('Logging out...');
    localStorage.clear(); // Clear all session data
    this.selectedDoctorId = null; // Reset selected doctor
    this.router.navigate(['/login']); // Redirect to login page
  }
  

  onCancelDelete() {
    console.log('Canceling account deletion...');
    this.activeSection = 'oath'; // Go back to Oath if cancel deletion
    console.log('Switched back to oath section');
  }



  
 
  ecgUploadMessage: string | null = null;
 

  // Fetch the list of doctors
  fetchGeneralDoctors() {
    this.isLoadingDoctors = true;
    this.http.get<any[]>('http://localhost:5000/api/cardiology-doctors')
      .subscribe({
        next: (doctors) => {
          this.generalDoctors = doctors; // Save the list of doctors
          this.isLoadingDoctors = false; // Stop loading
  
          // Log the fetched doctors to the console
          console.log('Fetched Doctors:', this.generalDoctors);
          console.log('Doctor ID Type:', typeof this.generalDoctors[0]._id);

        },
        error: (error) => {
          console.error('Error fetching doctors:', error);
          this.isLoadingDoctors = false;
        }
      });
  }
  
  // Method to handle section switch for sending to the doctor
  onSendToDoctor() {
    console.log('Send to general doctor');
    this.activeSection = 'send-to-doctor';
    this.fetchGeneralDoctors();
  }
 

  // Method to change the active section to "send-ecg"
 

  // Handle file selection
  // Handle the file selection for ECG
onFileSelect(event: any): void {
  const file = event.target.files[0];
  if (file) {
    this.selectedECGFile = file;
    console.log('Selected ECG file:', file);
  }
}


  // Method to handle the file upload
// onSelectDoctor method to capture the doctor's ID




onSelectDoctor(doctor: any) {
  const id = this.getDoctorId(doctor);

  if (!id) {
    console.error("Doctor ID is missing!", doctor);
    return;
  }

  console.log("Selected doctor ID:", id);
  this.selectedDoctorId = id;
}

// Helper function to handle both {_id: "123"} and {_id: {$oid: "123"}}
getDoctorId(doctor: any): string | null {
  if (!doctor || !doctor._id) return null;
  return typeof doctor._id === 'string' ? doctor._id : doctor._id.$oid || null;
}



onECGFileSelected(event: any): void {
  console.log('Selected Doctor ID:', this.selectedDoctorId); 
  const file = event.target.files[0];
  if (file) {
    this.selectedECGFile = file;
    console.log('Selected ECG file:', file);
  }
}
emergencyLevel: string | null = null;

// uploadECGFile method to handle the upload
uploadECGFile(): void {
  console.log('Emergency Level:', this.emergencyLevel);
  console.log('Selected Doctor ID:', this.selectedDoctorId);

  // ✅ Check if an emergency level is selected
  if (!this.emergencyLevel) {
    this.ecgUploadMessage = 'Please select an emergency level before uploading!';
    return;
  }

  // ✅ Check if a file is selected
  if (!this.selectedECGFile) {
    this.ecgUploadMessage = 'Please select a file first!';
    return;
  }

  // ✅ Check if a doctor is selected
  if (!this.selectedDoctorId) {
    this.ecgUploadMessage = 'Receiver (Doctor) ID is missing! Please select a doctor.';
    return;
  }

  // ✅ Get sender ID from localStorage
  const user = localStorage.getItem('user');
  const senderId = user ? JSON.parse(user).id : null;
  console.log('📦 Sender ID from user object:', senderId);

  if (!senderId) {
    this.ecgUploadMessage = 'Sender ID is missing!';
    return;
  }

  // ✅ Create form data
  const formData = new FormData();
  formData.append('file', this.selectedECGFile);
  formData.append('emergencyLevel', this.emergencyLevel); // ⬅️ Include emergency level

  // ✅ Show uploading message
  this.ecgUploadMessage = 'Uploading ECG...';

  // ✅ Make HTTP request
  this.http.post('http://localhost:5000/upload-ecg', formData, {
    headers: {
      'senderId': senderId,
      'receiverId': this.selectedDoctorId,
    }
  }).subscribe({
    next: (response: any) => {
      console.log('✅ ECG file uploaded successfully', response);
      this.ecgUploadMessage = 'ECG uploaded successfully!';
      this.selectedECGFile = null;

      // ✅ Reset emergency level after upload
      this.emergencyLevel = ''; // Reset emergency level after uploading the ECG
      console.log('Emergency level reset after upload:', this.emergencyLevel);
    },
    error: (error) => {
      console.error('❌ Error uploading ECG file:', error);
      if (error.status === 400) {
        this.ecgUploadMessage = 'Bad request: Please check the file and IDs.';
      } else if (error.status === 500) {
        this.ecgUploadMessage = 'Server error: Failed to upload ECG.';
      } else {
        this.ecgUploadMessage = 'Unexpected error occurred.';
      }
    }
  });
}

// Method to handle sending the ECG to a selected doctor
onSendECG(event: Event, index: number, doctor: any): void {
  event.stopPropagation(); // Prevent the doctor card click

  this.activeSection = "send-ecg"; // Show ECG upload section

  console.log('📤 Send ECG clicked - Index:', index, 'Doctor ID:', doctor._id);
  this.selectedDoctorId = doctor._id;

  // ✅ Check if a doctor is selected
  if (!doctor._id) {
    this.ecgUploadMessage = 'Receiver (Doctor) ID is missing!';
    return;
  }

  // ✅ Check if a file is selected
  if (!this.selectedECGFile) {
    this.ecgUploadMessage = 'Please select an ECG file first!';
    return;
  }

  // ✅ Check if an emergency level is selected
  if (!this.emergencyLevel) {
    this.ecgUploadMessage = 'Please select an emergency level before sending!';
    return;
  }

  // ✅ Prepare form data
  const formData = new FormData();
  formData.append('file', this.selectedECGFile);
  formData.append('emergencyLevel', this.emergencyLevel); // ⬅️ Include emergency level here too

  this.isLoading = true;

  // ✅ Make HTTP request
  this.http.post(`http://localhost:5000/upload-ecg/${doctor._id}`, formData).subscribe({
    next: () => {
      this.isLoading = false;
      this.ecgUploadMessage = 'ECG file sent successfully!';
      this.selectedECGFile = null;

      // ✅ Clear the emergency level after successful sending
      this.emergencyLevel = ''; // Reset emergency level after sending the ECG
      console.log('Emergency level reset after send:', this.emergencyLevel);
    },
    error: (error) => {
      this.isLoading = false;
      console.error('❌ Error sending ECG:', error);
      this.ecgUploadMessage = 'Failed to send ECG file.';
    }
  });
}
messages: { sender: string, text: string }[] = [];

toggleMessageMenu(index: number, event: MouseEvent) {
  event.stopPropagation();
  this.openMenuIndex = this.openMenuIndex === index ? null : index;
}

startEdit(index: number) {
  if (!this.selectedDoctorId) return;  // optional guard

  this.editingMessage = index;
  this.openMenuIndex = null;
  this.editMessageContent = this.conversations[this.selectedDoctorId!][index].content;
}

saveEdit(index: number) {
  if (!this.selectedDoctorId) {
    console.error('selectedDoctorId is null or undefined');
    return;
  }

  if (!this.editMessageContent.trim()) {
    this.cancelEdit_1();
    return;
  }
  
  const msg = this.conversations[this.selectedDoctorId][index];
  msg.content = this.editMessageContent.trim();
  msg.edited = true;
  this.editingMessage = null;

  localStorage.setItem('conversations', JSON.stringify(this.conversations));

  // Send update to backend
  this.http.put(`http://localhost:5000/api/messages/${msg._id}`, {
    content: msg.content,
    edited: true,
  }).subscribe({
    next: () => {
      console.log('Message updated successfully on backend.');
    },
    error: (err) => {
      console.error('Failed to update message on backend:', err);
    }
  });
}


cancelEdit_1() {
  this.editingMessage = null;
  this.editMessageContent = '';
}

confirmDelete_1(index: number) {
  this.openMenuIndex = null;
  if (confirm('Are you sure you want to delete this message?')) {
    this.deleteMessage(index);
  }
}
deleteMessage(index: number) {
  if (!this.selectedDoctorId) {
    console.error('selectedDoctorId is null or undefined');
    return;
  }

  const msg = this.conversations[this.selectedDoctorId][index];

  // Optimistically remove message locally
  this.conversations[this.selectedDoctorId].splice(index, 1);
  localStorage.setItem('conversations', JSON.stringify(this.conversations));

  // Send delete request to backend
  this.http.delete(`http://localhost:5000/api/messages/${msg._id}`).subscribe({
    next: () => {
      console.log('Message deleted successfully on backend.');
    },
    error: (err) => {
      console.error('Failed to delete message on backend:', err);
      // Optionally revert local deletion if needed
    }
  });
}
showToast(message: string, duration = 4000) {
  console.log('showToast called with message:', message);

  this.toastMessage = message;

  if (this.toastTimeout) {
    console.log('Clearing previous toast timeout');
    clearTimeout(this.toastTimeout);
  }

  this.toastTimeout = setTimeout(() => {
    console.log('Toast duration ended, clearing toastMessage');
    this.toastMessage = null;
  }, duration);
}

closeToast() {
  console.log('closeToast called, clearing toastMessage and timeout');
  this.toastMessage = null;
  if (this.toastTimeout) {
    clearTimeout(this.toastTimeout);
  }
}

handleIncomingMessage(msg: Message) {
  console.log('handleIncomingMessage called with msg:', msg);

  const roomId = msg.senderId === this.user.id ? msg.receiverId : msg.senderId;

  if (!this.conversations[roomId]) {
    this.conversations[roomId] = [];
  }

  // Check if message already exists (by timestamp and senderId)
  const existing = this.conversations[roomId].find(
    m => m.timestamp === msg.timestamp && m.senderId === msg.senderId
  );

  if (!existing) {
    // ✅ Use new array reference to trigger Angular change detection
    this.conversations[roomId] = [...this.conversations[roomId], msg];

    localStorage.setItem('conversations', JSON.stringify(this.conversations));

    console.log('handleIncomingMessage - msg.senderId:', msg.senderId, 'user.id:', this.user.id);

    if (msg.senderId !== this.user.id) {
      console.log('Calling showNotification()');
      this.showNotification(msg);

      const sender = msg.senderName || 'New Message';
      const content = msg.content || (msg.file?.name ? `📎 ${msg.file.name}` : 'New message');
      console.log('Calling showToast() with:', `${sender}: ${content}`);
      this.showToast(`${sender}: ${content}`);
    } else {
      console.log('Skipping notification because message is from self');
    }

  }
}


showNotification(msg: Message) {
  console.log('showNotification called for message:', msg);
  const content = msg.content || (msg.file?.name ? `📎 ${msg.file.name}` : 'New message');
  const sender = msg.senderName || 'New Message';

  // 🔊 Play notification sound
  const audio = new Audio('/assets/notif.mp3');
  audio.play().catch(err => console.warn('🔇 Sound error:', err));

  console.log('Checking notification conditions...');
  console.log('Notification.permission:', Notification.permission);
  console.log('Document.visibilityState:', document.visibilityState);

  // ✅ Only create system notification if page is not visible
  if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    console.log('Permission granted and page hidden — creating system notification...');
    try {
      const notification = new Notification(sender, {
        body: `${content} ${new Date().toLocaleTimeString()}`,
        icon: '/assets/chat.png',
        tag: msg.timestamp,
      
      });
        console.log('Notification object created:', notification);
      notification.onclick = () => {
        console.log('🖱️ Notification clicked — focusing window');
        window.focus();
        notification.close();
      };

      console.log('✅ System notification shown');
    } catch (error) {
      console.error('❌ Error creating notification:', error);
    }
  } else {
    console.log('Skipping system notification (either permission not granted or page visible)');
  }
}




onchat(event: any, index: number, doctor: any) {
  event.preventDefault();
  this.activeSection = "chat";

  console.log("🟢 Chat section activated");
  console.log("🔎 Full doctor object:", doctor);

  this.activeDoctor = doctor.name;
  const selectedId: string = doctor.id || doctor._id;

  if (!selectedId) {
    console.error("❌ Doctor ID is null or undefined");
    return;
  }

  this.selectedDoctorId = selectedId;
  console.log("👤 Selected doctor ID:", this.selectedDoctorId);

  this.chatService.joinRoom(this.selectedDoctorId);
  console.log("🔗 Joined chat room:", this.selectedDoctorId);

  this.chatService.getChatHistory(this.user.id, this.selectedDoctorId);
  console.log("📜 Fetching chat history for:", this.user.id, "↔️", this.selectedDoctorId);

  // Unsubscribe previous subscription to avoid duplicates
  if (this.chatHistorySubscription) {
    this.chatHistorySubscription.unsubscribe();
  }

  this.chatHistorySubscription = this.chatService.onChatHistory().subscribe(messages => {
    console.log("📩 Received chat history:", messages);
    this.conversations[this.selectedDoctorId!] = messages;
   

    // Mark messages as read ONLY when the chat is opened/selected
    this.chatService.markAsRead({
      senderId: this.selectedDoctorId!,
      receiverId: this.user.id
    });

    // Immediately update local message statuses to 'read'
    this.conversations[this.selectedDoctorId!].forEach(msg => {
      if (msg.senderId === this.selectedDoctorId && msg.status !== 'read') {
        msg.status = 'read';
      }
    });

    // Save updated conversations locally
    localStorage.setItem('conversations', JSON.stringify(this.conversations));
  });
}


  ngAfterViewChecked(): void {
  
}

 // private scrollToBottom(): void {
//   try {
//     this.chatBox.nativeElement.scrollTop = this.chatBox.nativeElement.scrollHeight;
//   } catch (err) {
//     console.error('Scroll to bottom failed:', err);
//   }
// }

startRecording() {
  console.log("🎙️ Attempting to start audio recording...");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Your browser does not support audio recording.');
    console.warn("❌ MediaDevices API not available.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      console.log("✅ Microphone access granted.");

      // ✅ Use safe MIME type based on support
      const preferredMime = 'audio/webm;codecs=opus';
      const fallbackMime = 'audio/webm';
      const mimeType = MediaRecorder.isTypeSupported(preferredMime)
        ? preferredMime
        : fallbackMime;

      console.log("🎛️ Using MIME type:", mimeType);

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        console.log("📦 Audio chunk received:", event.data);
        this.audioChunks.push(event.data);
      };

      // We'll fix this next in Step 2 ✅
      this.mediaRecorder.onstop = () => {
        console.log("🛑 Recording stopped. Processing audio...");
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        console.log("🧱 Blob created. Size:", audioBlob.size, "bytes");

        this.selectedAudioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: mimeType });

        if (this.audioPreviewUrl) {
          URL.revokeObjectURL(this.audioPreviewUrl);
        }
        this.audioPreviewUrl = URL.createObjectURL(audioBlob);
        console.log("🔗 Audio preview URL created:", this.audioPreviewUrl);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log("🎬 MediaRecorder started.");
    })
    .catch(err => {
      console.error('❌ Error accessing microphone:', err);
      alert('Could not start recording. Please check microphone permissions.');
    });
}


stopRecording() {
  console.log("⏹️ Stop recording requested...");

  if (this.mediaRecorder && this.isRecording) {
    try {
      this.isRecording = false;
      this.mediaRecorder.stop();
      console.log("🛑 MediaRecorder stopped.");

      // Stop all audio tracks after recorder is stopped
      const tracks = this.mediaRecorder.stream?.getTracks();
      if (tracks && tracks.length > 0) {
        tracks.forEach(track => {
          track.stop();
          console.log("🔇 Microphone track stopped.");
        });
      } else {
        console.warn("⚠️ No tracks found to stop.");
      }
    } catch (err) {
      console.error("❌ Error during stopping media recorder:", err);
    }
  } else {
    console.warn("⚠️ No active recording to stop.");
  }
}


uploadFile(file: File): Observable<{ url: string; name: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);

  return this.http.post<{ url: string; name: string; size: number }>(
    'http://localhost:5000/chat-upload', // <-- This matches your backend route
    formData
  );
}
sendMessage() {
  console.log('🔔 sendMessage() called');
  console.log('👉 Selected Doctor ID:', this.selectedDoctorId);
  console.log('👉 Current user:', this.user);
  console.log('👉 newMessage:', this.newMessage);
  console.log('👉 selectedFile_1:', this.selectedFile_1);
  console.log('👉 selectedAudioFile:', this.selectedAudioFile);

  if (!this.selectedDoctorId) {
    console.warn('⚠️ No doctor selected, aborting.');
    return;
  }

  // 🎤 Sending a recorded voice message
  if (this.selectedAudioFile) {
    console.log('🎤 Voice file detected:', this.selectedAudioFile);
    console.log('Sending voice message...');
    this.sendVoiceMessage();
    return;
  }

  // 📝 Prevent empty text/file sending
  if (!this.newMessage.trim() && !this.selectedFile_1) {
    console.warn('⚠️ Empty message and no file selected, aborting.');
    return;
  }

  const doctorId = this.selectedDoctorId;
  const timestamp = new Date().toISOString();
  console.log('📅 Generated timestamp:', timestamp);

  const getFileTypeFromName = (name: string): string => {
    const lowerName = name.toLowerCase();
    console.log('🔍 Determining file type for:', lowerName);
    if (lowerName.endsWith('.pdf')) return 'application/pdf';
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
    if (lowerName.endsWith('.png')) return 'image/png';
    if (lowerName.endsWith('.webm')) return 'audio/webm';
    return 'unknown';
  };

  const pushMessageLocally = (message: Message) => {
    console.log('📌 Pushing message locally:', message);
    this.conversations[doctorId] = [...(this.conversations[doctorId] || []), message];
    console.log('📚 Updated conversations:', this.conversations);
   
  };

  const sendToBackend = (fileData?: { url: string; name: string; size: number }) => {
    console.log('⚙️ Preparing message for backend...');
    
    const message: Message = {
      senderId: this.user.id,
      receiverId: doctorId,
      content: this.newMessage,
      status: 'sent',
      timestamp,
      type: fileData ? 'file' : 'text',
      file: fileData ? { ...fileData, type: getFileTypeFromName(fileData.name) } : undefined,
    };

    console.log('📤 Message ready to send:', message);

    // Display to sender immediately
    pushMessageLocally(message);

    // Send to backend
    console.log('🌐 Sending to backend via chatService...');
    try {
      this.chatService.sendMessage(message);
      console.log('✅ Message sent to backend (chatService.sendMessage called)');
    } catch (err) {
      console.error('❌ Error sending message to backend:', err);
    }

    // Reset input
    console.log('🧹 Resetting input fields...');
    this.newMessage = '';
    this.selectedFile_1 = null;
    this.isFileSelected = false;
    this.previewUrl = '';
    console.log('✅ Input fields reset');
  };

  // Handle file upload if a file is selected
  if (this.selectedFile_1) {
    console.log('📂 File selected, starting upload:', this.selectedFile_1);
    this.uploadFile(this.selectedFile_1).subscribe({
      next: (response) => {
        console.log('✅ File upload success:', response);
        if (!response.url) console.warn('⚠️ Uploaded file has no URL!');
        sendToBackend(response);
      },
      error: (err) => {
        console.error('❌ File upload failed:', err);
      },
      complete: () => console.log('📦 File upload observable completed'),
    });
  } else {
    console.log('🚀 No file selected, sending plain text message...');
    sendToBackend();
  }

  console.log('📝 sendMessage() finished execution');
}


sendVoiceMessage() {
  if (!this.selectedAudioFile) {
    console.warn("❌ No audio file selected.");
    return;
  }

  const doctorId = this.selectedDoctorId;
  if (!doctorId) {
    console.warn("❌ No doctor selected.");
    return;
  }

  console.log("📤 Uploading voice message:", this.selectedAudioFile);

  this.uploadFile(this.selectedAudioFile).subscribe({
    next: (fileData) => {
      console.log("✅ Voice message uploaded:", fileData);

      const messageData: Message = {
        senderId: this.user.id,
        receiverId: doctorId,
        content: '',            // optional because type !== 'text'
        type: 'voice',          // ⚡ important: mark this as a voice message
        status: "sent",
        timestamp: new Date().toISOString(),
        file: {
          name: fileData.name,
          url: fileData.url,
          size: fileData.size,
          type: this.selectedAudioFile!.type 
        }
      };

      // ✅ Update local conversation array for sender
      this.conversations[doctorId] = [...(this.conversations[doctorId] || []), messageData];

      // Send to backend (will broadcast to receiver)
      this.chatService.sendMessage(messageData);

      // Reset input
      this.resetInput();
      
    },
    error: (err) => {
      console.error('❌ Failed to upload voice message:', err);
    }
  });
}


// Reset inputs after sending message
resetInput() {
  this.newMessage = '';
  this.selectedFile_1 = null;
  this.selectedAudioFile = null;
  this.isFileSelected = false;
  this.previewUrl = '';
  if (this.audioPreviewUrl) {
    URL.revokeObjectURL(this.audioPreviewUrl);
    this.audioPreviewUrl = null;
  }
}
toggleAudio(msg: any) {
  const audioRef = this.audioRefs.find(ref => ref.nativeElement.src.includes(msg.file.url));
  if (!audioRef) return;

  const audio = audioRef.nativeElement;

  if (msg.isPlaying) {
    audio.pause();
    msg.isPlaying = false;
  } else {
    this.audioRefs.forEach(ref => ref.nativeElement.pause());

    if (this.selectedDoctorId && this.conversations[this.selectedDoctorId]) {
      this.conversations[this.selectedDoctorId].forEach((m: any) => m.isPlaying = false);
    }

    audio.play().then(() => {
      msg.isPlaying = true;
    }).catch((err: any) => {
      console.error("Playback failed:", err);
      msg.isPlaying = false;
    });
  }
}


onAudioEnded(msg: any) {
  msg.isPlaying = false;
}

async setAudioDuration(msg: any, event: Event) {
  const audioElement = event.target as HTMLAudioElement;

  // Helper function to check if duration is valid
  const isValidDuration = (d: number) => isFinite(d) && !isNaN(d) && d > 0;

  const waitForEvent = (evName: string) => new Promise<void>((resolve) => {
    const handler = () => {
      audioElement.removeEventListener(evName, handler);
      resolve();
    };
    audioElement.addEventListener(evName, handler, { once: true });
  });

  const trySet = () => {
    const dur = audioElement.duration;
    console.log('🔍 Attempting to read duration:', dur);
    if (isValidDuration(dur)) {
      msg.duration = this.formatDuration(dur);
      console.log('✅ Duration set:', msg.duration);
      return true;
    }
    return false;
  };

  // Try immediately
  if (trySet()) return;

  // Wait for loadedmetadata
  await waitForEvent('loadedmetadata');
  if (trySet()) return;

  // Wait for canplaythrough
  await waitForEvent('canplaythrough');
  if (trySet()) return;

  // Wait a bit longer (300ms) as a last retry
  await new Promise(r => setTimeout(r, 300));
  if (trySet()) return;

  // Fallback
  msg.duration = '0:00';
  console.warn('⚠️ Duration invalid, fallback applied.');
}






onInputChange() {
  if (!this.selectedDoctorId) return;

  this.chatService.typing(this.user.id, this.selectedDoctorId);

  if (this.typingTimeout) {
    clearTimeout(this.typingTimeout);
  }

  this.typingTimeout = setTimeout(() => {
    if (!this.selectedDoctorId) return;
    this.chatService.stopTyping(this.user.id, this.selectedDoctorId);
  }, 2000);
}
updateProgress(msg: any, event: Event) {
  const audio = event.target as HTMLAudioElement;
  msg.currentTime = audio.currentTime;
  msg.duration = audio.duration;
  msg.progress = (audio.currentTime / audio.duration) * 100;
}

seekAudio(msg: any, event: MouseEvent) {
  const progressBar = event.currentTarget as HTMLElement;
  const clickX = event.offsetX;
  const width = progressBar.clientWidth;

  const clickRatio = clickX / width;
  const audioElem = this.audioRefs.find(ref => ref.nativeElement.src.includes(msg.file.url))?.nativeElement;


  if (audioElem && msg.duration) {
    audioElem.currentTime = clickRatio * msg.duration;
  }
}

formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

ngOnDestroy(): void {
  this.chatHistorySubscription?.unsubscribe();
  if (this.typingTimeout) {
    clearTimeout(this.typingTimeout);
  }
  // Pause all audio
  this.audioRefs?.forEach(ref => {
    const audio = ref.nativeElement;
    audio.pause();
  });
   this.peerConnection?.close();
}



rateDoctor(rating: number): void {
  const doctor = this.getSelectedDoctor();
  if (!doctor) {
    console.error('No doctor selected for rating');
    return;
  }

  // Assume currentUserId is set somewhere in your component (e.g. from auth service)
   const raterId = this.user?.id;
  if (!raterId) {
    console.error('No raterId available - cannot submit rating');
    return;
  }

  console.log('Rating doctor:', doctor.name, 'New rating:', rating);

  doctor.rating = rating;
  this.selectedRating = rating;

  this.http.put(`http://localhost:5000/api/doctors/${doctor._id}/rate`, {
    rating,
    raterId
  }).subscribe({
    next: () => {
      console.log(`Rated doctor ${doctor.name} with ${rating} stars`);
    },
    error: (err) => {
      console.error('Error updating rating:', err);
    }
  });
}


selectedRating: number = 0;

onrate($event: any, i: number, doctor: any): void {
  this.activeSection = "rate";
  this.activeDoctor = doctor;
  this.selectedDoctorId = this.getDoctorId(doctor); // ✅ This is the missing link
  this.selectedRating = doctor.rating || 0; // Optional: initialize selectedRating from backend
  console.log('Active Section:', this.activeSection);
  console.log($event, i, doctor);
}
// Add these class properties

hoveredRating: number | null = null;

// Method to handle hovering over a star
hoverRating(rating: number): void {
  this.hoveredRating = rating;
}

// Method to reset hover effect when mouse leaves
resetHoveredRating(): void {
  this.hoveredRating = null;
}


backToList(): void {

  this.activeSection = 'send-to-doctor'; // Go back to doctor list view
}
// Assuming you already have a list of doctors fetched in `generalDoctors`
getSelectedDoctor(): any {
  return this.generalDoctors.find((doctor) => doctor._id === this.selectedDoctorId);
}
onreport($event: any, i: number, doctor: any) {
  console.log('Report button clicked', doctor);
  this.activeSection = 'report-doctor';  // Switch to the report-doctor section
  this.activeDoctor = doctor;  // Store the entire doctor object
  this.selectedDoctorId = doctor._id;  // Get the doctor ID from the doctor object
}


reason: string = '';


onSubmit(): void {
  if (!this.activeDoctor || !this.reason) {
    console.error('Doctor or reason is missing!');
    return;
  }

  // Retrieve the username from localStorage
  const user = localStorage.getItem('user');
  if (!user) {
    console.error('No user found in localStorage');
    return;
  }

  // Prepare the report object to send to the backend
  const report = {
    username: user,               // Username from localStorage
    reportedDoctor: this.activeDoctor,  // The doctor being reported
    reason: this.reason,          // The reason for reporting
  };

  console.log('Reporting doctor:', this.activeDoctor, 'Reason:', this.reason);

  // Send the report to the backend
  this.http.post(`http://localhost:5000/api/doctors/${this.selectedDoctorId}/report`, report)
    .subscribe({
      next: () => {
        console.log(`Reported doctor ${this.activeDoctor} for reason: ${this.reason}`);
        this.reason = ''; // Reset the reason after submission
        // Optionally reset active section or navigate away

        // Display a confirmation message with MatSnackBar
        this.snackBar.open('Your report has been submitted. The admin will examine it and get back to you.', 'Close', {
          duration: 5000, // Duration for the message (in ms)
        });
      },
      error: (err) => {
        console.error('Error reporting doctor:', err);
      }
    });
}
async startScreenShare() {
  if (this.callType !== 'video' || !this.peerConnection || !this.localStream) return;

  try {
    // Capture screen
    this.screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: true,
      audio: false // set true if system audio is needed
    });

    if (!this.screenStream) return; // safety check

    this.isScreenSharing = true;

    // Replace video track in the peer connection
    const screenTrack = this.screenStream.getVideoTracks()[0];
    if (!screenTrack) return; // safety check

    const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
      sender.replaceTrack(screenTrack);
    }

    // Update local video so you can see the shared screen
    const localVideoEl = document.querySelector('#localVideo') as HTMLVideoElement | null;
    if (localVideoEl) {
      localVideoEl.srcObject = this.screenStream;
    }

    // Handle user stopping screen sharing from browser UI
    screenTrack.onended = () => {
      this.stopScreenShare();
    };

  } catch (err) {
    console.error('❌ Error sharing screen:', err);
  }
}

stopScreenShare() {
  if (!this.screenStream || !this.localStream || !this.peerConnection) return;

  // Stop all tracks of the screen
  this.screenStream.getTracks().forEach(track => track.stop());
  this.screenStream = null;
  this.isScreenSharing = false;

  // Restore camera video track
  const cameraTrack = this.localStream.getVideoTracks()[0];
  const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
  if (sender && cameraTrack) sender.replaceTrack(cameraTrack);

  // Restore local video
  const localVideoEl = document.querySelector('#localVideo') as HTMLVideoElement;
  if (localVideoEl) localVideoEl.srcObject = this.localStream;
}

view: CalendarView = CalendarView.Week;
CalendarView = CalendarView;


viewDate: Date = new Date();
refresh = new Subject<void>();



// NEW: scheduling state
selectedDateStr: string | null = null;
selectedTime: string = '';
newEventTitle: string = '';
timeSlots: string[] = [];



  // Initialize as an empty array of CalendarEvent
 
  
 
generateTimeSlots(): void {
  this.timeSlots = [];
  for (let hour = 0; hour < 24; hour++) {
    const formatted = hour.toString().padStart(2, '0');
    this.timeSlots.push(`${formatted}:00`);
  }
}



loadAvailability() {
  if (!this.selectedDoctorId) return;

  this.http.get<any[]>(`http://localhost:5000/api/doctors/${this.selectedDoctorId}/availability`)
    .subscribe((availability) => {
      this.events = availability.flatMap(day =>
        day.slots.map((slot: string) => {
          const startDate = new Date(`${day.day}T${slot}`);
          const endDate = new Date(startDate.getTime() + 30 * 60000);

          return {
            start: startDate,
            end: endDate,
            title: 'Available Video Slot',
            color: { primary: '#4caf50', secondary: '#c8e6c9' },
            meta: { doctorId: this.selectedDoctorId, slot }
          };
        })
      );

      this.refresh.next(); // Notify the calendar to update
    });
}

onSlotClick(event: { date: Date; sourceEvent: MouseEvent }) {
  const { date, sourceEvent } = event;
  console.log(date);
}

onbook(event: any, i: number, doctor: any): void {
  this.activeSection = 'calendar-wrapper';
  console.log('Booking clicked:', { event, i, doctor });
}

// ✅ NEW: Replaces prompt-based scheduling
handleDateSelect(selectInfo: DateSelectArg, doctorId: string): void {
  this.selectedDateStr = selectInfo.startStr.split('T')[0];
  this.selectedDoctorId = doctorId;
  this.newEventTitle = '';
  this.selectedTime = '';
}

cancelScheduling(): void {
  console.log('🧹 cancelScheduling() called');
  console.log('Before reset:', {
    selectedDateStr: this.selectedDateStr,
    selectedTime: this.selectedTime,
    newEventTitle: this.newEventTitle
  });

  this.selectedTime = '';
  this.newEventTitle = '';

  setTimeout(() => {
    this.selectedDateStr = null;
    console.log('Form has been reset. selectedDateStr is now null');
  }, 50);
}


resetEventForm(): void {
  this.selectedDateStr = null;
  this.selectedTime = '';
  this.newEventTitle = '';
// optional, if you want to reset doctor too
}

confirmScheduling(): void {
  console.log('🚀 confirmScheduling() triggered');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user.id;

  if (!this.selectedDateStr || !this.selectedTime || !this.newEventTitle.trim() || !userId || !this.selectedDoctorId) {
    console.warn('⚠️ Missing required fields', {
      selectedDateStr: this.selectedDateStr,
      selectedTime: this.selectedTime,
      newEventTitle: this.newEventTitle,
      userId,
      selectedDoctorId: this.selectedDoctorId
    });
    return;
  }

  const localDateTime = new Date(`${this.selectedDateStr}T${this.selectedTime}:00`);
  const zonedDate = moment(localDateTime).tz('Africa/Tunis', true).toDate();

  const eventData = {
    title: this.newEventTitle,
    date: zonedDate,
    userId,
    doctorId: this.selectedDoctorId
  };

  this.http.post('http://localhost:5000/events', eventData).subscribe({
    next: (response: any) => {
      console.log('✅ Event saved successfully:', response);

      if (!this.calendarEvents) {
  this.calendarEvents = [];
}
this.calendarEvents.push({
  title: this.newEventTitle,
  start: zonedDate.toISOString(),
  end: new Date(zonedDate.getTime() + 60 * 60 * 1000).toISOString(),
  allDay: false
});


      try {
  const serialized = JSON.stringify(this.calendarEvents);
  localStorage.setItem('calendarEvents', serialized);
  console.log('💾 calendarEvents saved to localStorage');
} catch (err) {
  console.error('❌ Failed to save calendarEvents to localStorage:', err);
}


      console.log('📴 About to call cancelScheduling()');
      console.log('cancelScheduling is a function?', typeof this.cancelScheduling === 'function');

      this.cancelScheduling();
    },
    error: (error) => {
      console.error('❌ Error saving event:', error);
    }
  });
}

 onShowChatbot() {
  this.activeSection = 'bot';

  // ✅ Assign full user object for later use
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      this.user = JSON.parse(userStr);
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }

  this.fetchChatHistory_nawress(() => {
    console.log('Chatbot conversation:', this.chatbotConversation);

    if (this.chatbotConversation.length === 0) {
  const userId = this.user?.id || '';

  this.chatbotConversation = [...this.chatbotConversation, {
    senderId: 'medical_bot'
,
    receiverId: userId,
    content: `👋 Hello! I hope you're doing great today!<br><br>How can I assist you?<br>`,
    status: 'sent',
    timestamp: new Date().toISOString(),
    options: [
      { label: 'Ask a Question', value: 'question' },
      
      { label: 'Exit', value: 'exit' }
    ]
  }];
  console.log('Greeting message with options:', this.chatbotConversation[0]);
  this.selectedMode = null;
}
  });
}

loadChatHistory(): void {
  const userId = (() => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user)?.id || '' : '';
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
      return '';
    }
  })();

  this.http.get<Message[]>(`/api/chat/history?userId=${userId}`).subscribe({
    next: (history) => {
      this.chatbotConversation = history;
    },
    error: () => {
      console.error('Failed to load chat history.');
    }
  });
}

fetchChatHistory_nawress(callback?: () => void): void {
  let userId = '';
  try {
    const user = localStorage.getItem('user');
    userId = user ? JSON.parse(user)?.id || '' : '';
  } catch (e) {
    console.error('Error parsing user from localStorage:', e);
  }

  if (!userId) {
    console.warn('No user ID found, skipping chat history fetch.');
    return;
  }

  console.log('Fetching chat history for user ID:', userId);

  this.http.get<Message[]>(`http://localhost:5000/api/getChat_nawress/${userId}`).subscribe({
    next: (messages) => {
      console.log('Fetched messages:', messages);
      
      if (!messages || messages.length === 0) {
        // No previous messages → inject greeting with options
        this.chatbotConversation = [{
          senderId: 'medical_bot'
,
          receiverId: userId,
          content: `👋 Hello! I hope you're doing great today!<br><br>How can I assist you?<br><br>`,
          status: 'sent',
          timestamp: new Date().toISOString(),
          options: [
            { label: 'Ask a Question', value: 'question' },
           
            { label: 'Exit', value: 'exit' }
          ]
        }];
        console.log('💡 Injected greeting message with options:', this.chatbotConversation[0]);
      } else {
        // Existing messages → load from backend
        this.chatbotConversation = messages;
      }

      this.cdr.detectChanges(); // Ensure UI updates
      console.log('Updated chatbotConversation:', this.chatbotConversation);

      if (callback) callback();  // Optional callback after load
    },
    error: (err) => {
      console.error('Failed to fetch chat history:', err);
    }
  });
}

sendChatbotMessage(): void {
  if (!this.chatbotMessage.trim()) return;

  const userId = (() => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user)?.id || '' : '';
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
      return '';
    }
  })();

  const userMsg: Message = {
    senderId: userId,
    receiverId: 'medical_bot',
    content: this.chatbotMessage,
    status: 'sent',
    timestamp: new Date().toISOString()
  };

  this.chatbotConversation = [...this.chatbotConversation, userMsg];
  const question = this.chatbotMessage;
  this.chatbotMessage = '';
  this.isTyping = true;

  console.log('Sending question to Flask backend:', question);

  // Envoi vers Flask backend
  this.http.post<ChatbotResponse>(
    'http://localhost:3000/api/chat',
    { userId, question }
  ).subscribe({
    next: (res) => {
      console.log('Received response from /api/chat:', res);

      const botMsg: Message = {
        senderId: 'medical_bot',
        receiverId: userId,
        content: res.answer,
        origin: res.origin,  // now recognized by TS
        status: 'delivered',
        timestamp: new Date().toISOString(),
        showOrigin: false 
      };

      this.chatbotConversation = [...this.chatbotConversation, botMsg];
      this.isTyping = false;

      // Logs avant d’envoyer la sauvegarde
      console.log('Saving user message to Node.js backend:', userMsg);
      console.log('Saving bot message to Node.js backend:', botMsg);

      // Sauvegarde user message
      this.http.post('http://localhost:5000/api/saveChat_nawress', userMsg).subscribe({
        next: () => console.log('User message saved successfully'),
        error: (err) => console.error('Error saving user message:', err)
      });

      // Sauvegarde bot message
      this.http.post('http://localhost:5000/api/saveChat_nawress', botMsg).subscribe({
        next: () => console.log('Bot message saved successfully'),
        error: (err) => console.error('Error saving bot message:', err)
      });
    },
    error: (err) => {
      console.error('Chat API error:', err);

      const errorMsg: Message = {
        senderId: 'medical_bot',
        receiverId: userId,
        content: '❌ An error occurred. Please try again.',
        status: 'delivered',
        timestamp: new Date().toISOString()
      };

      this.chatbotConversation = [...this.chatbotConversation, errorMsg];
      this.isTyping = false;
    }
  });
}

sendClinicalCaseToBackend(fullCaseText: string, originalCaseData: any) {
  const userId = this.user?.id || '';
  const userMsg: Message = {
    senderId: userId,
    receiverId: 'medical_bot',
    content: fullCaseText,
    status: 'sent',
    timestamp: new Date().toISOString()
  };

  console.log('[🟡] Sending clinical case:', { userId, fullCaseText });

  this.isTyping = true;

  this.chatbotConversation = [...this.chatbotConversation, userMsg];

  this.http.post<ChatbotResponse>('http://localhost:3000/api/clinical-case', {
    userId,
    caseDetails: fullCaseText
  }).subscribe({
    next: (res) => {
      const botMsg: Message = {
        senderId: 'medical_bot',
        receiverId: userId,
        content: res.answer,
        origin: res.origin,
        status: 'delivered',
        timestamp: new Date().toISOString(),
        showOrigin: false
      };

      // ✅ Use the correct case data (not reset version)
      this.caseDataFinal = originalCaseData;
      console.log('📄 caseDataFinal SET:', this.caseDataFinal);

      this.chatbotConversation = [...this.chatbotConversation, botMsg];

      const followUp: Message = {
        senderId: 'medical_bot',
        receiverId: userId,
        content: '✅ Case analyzed! Would you like to:',
        status: 'sent',
        timestamp: new Date().toISOString(),
        options: [
          { label: 'Submit another case', value: 'newCase' },
          { label: 'Ask a question', value: 'newQuestion' },
          { label: 'Exit', value: 'exit' }
        ]
      };

      this.chatbotConversation = [...this.chatbotConversation, followUp];

      this.isTyping = false;

      this.http.post('http://localhost:5000/api/saveChat_nawress', userMsg).subscribe();
      this.http.post('http://localhost:5000/api/saveChat_nawress', botMsg).subscribe();

      this.cdr.detectChanges();
    },
    error: () => {
      this.chatbotConversation = [...this.chatbotConversation, {
        senderId: 'medical_bot',
        receiverId: userId,
        content: '❌ An error occurred while analyzing the case. Please try again.',
        status: 'delivered',
        timestamp: new Date().toISOString()
      }];
      this.isTyping = false;
      this.cdr.detectChanges();
    }
  });
}


copyToClipboard(html: string) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const text = temp.textContent || temp.innerText || '';
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ Réponse copiée dans le presse-papiers !');
  });
}

startListening() {
  if (!this.speechRecognition) return;

  if (this.isListening) {
    this.speechRecognition.stop();
  } else {
    this.isListening = true;
    this.speechRecognition.start();
  }
}

toggleOrigin(msg: Message) {
  msg.showOrigin = !msg.showOrigin;
}

setMode(mode: 'question' | 'case') {
  console.log('🔄 Mode selected:', mode);

  // ❌ Only clear the case report if the user is explicitly starting a new case
  const isStartingNewCase = mode === 'case' && this.selectedMode !== 'case';

  if (isStartingNewCase) {
    this.caseDataFinal = {};  // ✅ Clear previous report only when starting a fresh case
  }

  // Avoid reapplying the same mode
  if (this.selectedMode === mode) {
    console.log('⚠️ Mode already selected, skipping update.');
    return;
  }

  this.selectedMode = mode;

  if (mode === 'case') {
    this.caseData = {};
    this.currentCaseStep = 0;
    const firstQuestion = this.caseQuestions[this.currentCaseStep];

    this.chatbotConversation = [
      ...this.chatbotConversation,
      {
        senderId: 'medical_bot',
        receiverId: this.user?.id || '',
        content: firstQuestion,
        timestamp: new Date().toISOString(),
        status: 'sent'
      }
    ];
  }

  if (mode === 'question') {
    const questionPrompt = '✅ You can now ask your medical question.';

    this.chatbotConversation = [
      ...this.chatbotConversation,
      {
        senderId: 'medical_bot',
        receiverId: this.user?.id || '',
        content: questionPrompt,
        timestamp: new Date().toISOString(),
        status: 'sent'
      }
    ];
  }

  this.cdr.detectChanges();
}

get hasCaseReport(): boolean {
  return !!this.caseDataFinal && Object.keys(this.caseDataFinal).length > 0;
}


get showQuestionInput() {
  return this.selectedMode === 'question';
}

get showCaseInput() {
  return this.selectedMode === 'case';
}

// Option selection logic
chooseOption(option: 'question' | 'case') {
  this.setMode(option); // instead of just this.selectedMode = option
}

sendQuestion() {
  if (!this.question.trim()) return;

  const userQuestion = this.question.trim();
  this.question = ''; // Clear input

  const userMessage: Message = {
    senderId: this.user?.id || '',
    receiverId: 'medical_bot',
    content: userQuestion,
    status: 'sent',
    timestamp: new Date().toISOString(),
  };

  this.chatbotConversation.push(userMessage);
  this.chatbotMessage = userQuestion;

  // Send question to backend and handle response
  const userId = this.user?.id || '';

  this.isTyping = true;
  this.http.post<ChatbotResponse>('http://localhost:3000/api/chat', {
    userId,
    question: userQuestion
  }).subscribe({
    next: (res) => {
      const botResponse: Message = {
        senderId: 'medical_bot',
        receiverId: userId,
        content: res.answer,
        origin: res.origin,
        status: 'delivered',
        timestamp: new Date().toISOString(),
        showOrigin: false
      };

      // Add bot's actual response
      this.chatbotConversation.push(botResponse);

      // Add follow-up options
      const followUpMessage: Message = {
        senderId: 'medical_bot',
        receiverId: userId,
        content: 'Would you like to submit another question or exit?',
        status: 'sent',
        timestamp: new Date().toISOString(),
        options: [
          { label: 'Submit another question', value: 'newQuestion' },
        
          { label: 'No, exit', value: 'exit' }
        ]
      };

      this.chatbotConversation.push(followUpMessage);

      // Save both messages
      this.http.post('http://localhost:5000/api/saveChat_nawress', userMessage).subscribe();
      this.http.post('http://localhost:5000/api/saveChat_nawress', botResponse).subscribe();

      this.isTyping = false;
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('Error sending question:', err);
      this.isTyping = false;
      this.chatbotConversation.push({
        senderId: 'medical_bot',
        receiverId: userId,
        content: '❌ An error occurred. Please try again.',
        status: 'delivered',
        timestamp: new Date().toISOString()
      });
      this.cdr.detectChanges();
    }
  });
}


sendCase() {
  const answer = this.clinicalCase.trim();
  if (!answer) return;

  const key = this.caseKeys[this.currentCaseStep];
  this.caseData[key] = answer;

  this.chatbotConversation = [
    ...this.chatbotConversation,
    {
      senderId: this.user?.id || '',
      receiverId: 'medical_bot',
      
      content: answer,
      status: 'sent',
      timestamp: new Date().toISOString()
    }
  ];

  this.clinicalCase = '';

  const isLastQuestion = this.currentCaseStep === this.caseQuestions.length - 1;

  if (!isLastQuestion) {
    this.currentCaseStep++;
    this.chatbotConversation = [
      ...this.chatbotConversation,
      {
        senderId: 'medical_bot',
        receiverId: this.user?.id || '',
        content: this.caseQuestions[this.currentCaseStep],
        status: 'sent',
        timestamp: new Date().toISOString()
      }
    ];
  } else {
    const fullCaseText = Object.entries(this.caseData)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    this.chatbotConversation = [
      ...this.chatbotConversation,
      {
        senderId: 'medical_bot',
        receiverId: this.user?.id || '',
        content: 'Thanks for the information! Sending the case for analysis...',
        status: 'sent',
        timestamp: new Date().toISOString()
      }
    ];

    // ✅ Pass original case data clone to preserve it in the backend response
    this.sendClinicalCaseToBackend(fullCaseText, { ...this.caseData });

    // ❗ Now reset only current step and selected mode (not caseDataFinal)
    this.currentCaseStep = -1;
    this.selectedMode = null;
  }

  this.cdr.detectChanges();
}


cancelCase() {
  this.caseDataFinal = {};  // ✅ Reset to hide Download button
  this.caseData = {};
  this.currentCaseStep = -1;
  this.selectedMode = null;

  const cancellationMessage: Message = {
    senderId: 'medical_bot',
    receiverId: this.user?.id || '',
    content: 'Clinical case input cancelled. How else can I assist you?',
    status: 'sent',
    timestamp: new Date().toISOString(),
    options: [
      { label: 'Submit another question', value: 'newQuestion' },
      { label: 'Submit a clinical case', value: 'newCase' },
      { label: 'No, exit', value: 'exit' }
    ]
  };

  this.chatbotConversation = [
    ...this.chatbotConversation,
    cancellationMessage
  ];

  this.cdr.detectChanges(); // 👁️ Ensure UI updates
}



generateCasePDF(): void {
  

  // Define image paths (replace with actual paths or base64 strings)
  const imagePath_1 = 'data:image/png;base64,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';
  const imagePath_2 = 'data:image/png;base64,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';
  const imagePath_3 = 'data:image/png;base64,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';
  const imagePath_4 = 'data:image/png;base64,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';
  const imagePath_5 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQkAAAC+CAMAAAARDgovAAAAn1BMVEX3+/7///8AAAD5+vz///35/f/2+//3+v/8/Pz6/v/3+Pr8/f/z9PRgYGL0+Pvj5OXr7e/T1NXe3t5lZWeHh4eSkpJxcXFrbGxMTU6NjY2wsLDExMShoaFcXFxSUlLq6uq+vr4zNDXDw8Orq6sdHR7Nzs93d3ciIyQ/QD+AgIKkpKQSEhI5OjsrLC0eHx6QkZJERUUSFBg1NTkWFxxVWFteWLbAAAAQsElEQVR4nO1dDXuiuhJmkkZDkoYPwQ/EQqtisXXr3tv//9vuTEBr2z1nd+91jxfLu09bRPAwr5P5yiTH83r06NGjR48ePXr06NGjR48ePXr06NGjR48ePXr06NGjR48ePXr0+D/CoIGwnieE53HOL/1EFwQx4flIhb30k/w/gCv8Jxwrl36Uy4JLANDel2XiKLSAYpnmAYgvzYQQnKucEcahf+lHuhCcAliuoCGCsdqz4tIPdRE4JgTXMWNPVZY+MZb5X9N/NEaByzFqg5SQMfbM9ZeMJxwTXJeoEopLbkaMzUBd+qkuBKWlfGRsC0PPgzVju1g6pfhyHsRvzOWt8Ug9oGKsgqGwvvpihlMMLJfBPWNzf0hM6GDD2NoXvvfFiECXaTnUjI1AOCacftxZSsYu/Wj/MIQVMmJsFevGMHBuUEGW4H09KnwLt4ylujULigP6kftQ8q9GhPAkxhAbIzwyDUJoTEgnjCWg5KUf7R8Gjgb0oBk4DcBfSipYP7FVJL9awYY3HpS3JhJ1QlhIMBP7ekwEO/SgGFUKjDRBc+WjOwlWdO6rMVFTJKUUt35Y5lngkzuBJWOP6isw4aqWroCr0YM+xT4m4r54xZx8isf+0Gtsh9L22kPuwbEsJfeYcPgovecnrjxxd+N7wyb9CDD98K+fCY8qVcJ3sYPTDoMqsURejC+GQskReVJuxdUz0fxVBcaTD4AaIWw4ZQwwkihQJwTnMaYfkSRl+QLAcDJlbKFcyM3DuwMT1hsq5TzpFzCZDlLGmHCsUSUsqUerE1TRHWJYoVApSvgKyccAw0vnQZsEg4dvTAyGeEKiJ73X11/dHXCuNDqIVai9IeITE1yZBWP59Zc00SZyeCRRaSwgFfzEYiITwmqJRN0HV1/SJCJQ/acGxwbpxJAXpzqBQ0dJqneP4dJP+ocx5FwXz+RBUeyhHZww0egEKg0aVPKk1+1GMdvi5CZHoommyXq+sxPNJAg52ZFClnhjS64RaAYCxr5Fx1L+JyZojtA331z6QSRcKRUYOpIRSOAYbf6ICd/QlNiG8yE5kOHwOgNvSjieQkxA/4YJIbihEido50CuUic8D3Y06cU9+xdMNGclJe27WOnLPeifxFB4CraMvRpS+kZmDC8M5h0Pdy4X9RomBhYzk4qxSTNPenXhpo9Zhg6e2/Lc0U4omv5B7DlJfBgIWkeoPBFYe6WtBPRNj3BsHBuJfKV5iCEn20XwRoTwrNdoj+/73rVxQYGSiMmDNhnF0U5wXmwnSUC1bfFmGweedM0lQohrS0utxTjBeYQTJijSwvAaAAcMF+LgJVwMQVNi30Mi4np0wtohODzgMDBuimtwGAikExBlc3A64WR26chQGOV4w5PXoBNOCgU8LpPJ+GW+o8jRSStU+/2jGaBKHts8aP5+ykdwV8+5EkdK36YPcbVp++vYyDT2T3DnMAfoIsOFe+cp0B8mvzhgOFppex2DwwrfpuwN3w4TobxRCetT0LlLMZ6oQen3OuHqvmu4Ct+BPDThQlKu52VFR83wOFpHNxeaAQ6EBU2Ivd068C2X1FxiLvPoZ4bl+oWaTg2ARgSVo8K95ZjAuAnwgtSgLR19apxoqlvLq2io0FSyZEsgE6C40k5BDE0GH/Mqf46nFivGcvgwCqxQbugYcQUBtwJMr160Vtx5Bt42i1BXWZNi+MIXL81soLbis7zK5fA/eKNj4JRSPhbeURJOdZrHgCYBG5XAuEn4+Z6tXkL83j9PfPnkSV0hr9tkcJ1T5y2Zg0ZGK2BBKRgetaMDo2mjTWgo8vhR5ZIMaup3nQjP5daRdtN+gwHJ7joktoDx5CGysj6t+FFE1idrgGkaeZUJBerdpsJ1YxcaQ2crXAjtWTKhM1BoMdFjctdVxNvg8gMRbvxYGl+V6n5urkauFjU8JhPKX5MJ/HUUOJq23beYnnajg4xEaxUU1WrvR4tfxjPNh13B1AdNXKRw0gzBYcR+E6s5BhqdVwqyClPzZgA0D3+XiNtIkesYdJwLBXtXm1GtXVSS1i4EvwELruOq84Urrqk4UwI5SqTBdaOyADDi1O8AWkr83WQnsjnnO3hUwsBQo+vxNud6hrKnBWYeEiCgtGMLh9DbJSMEpzE6mE4LF1twRbAOoqlZdZwHz5OcU18Im6bropin6AjYTEql3q9946gNStMM0PKHntQF2x3nAkV2EcEbxvJGcoq1Tq6C9TQDal7ehWE1nd5N747Aw+ko8jsfWQ00xLPp6pSJzQKHCgUXJ1SQNmxfKdWiWPwzxrbDVNBzW99f3zayPE8Xo9HrdNdKFnAMtF0Hv7tYNnn5LgAdPa82LVbHv0u0l13tz6S0m4NpKph3+ToOFeacYTxPH53MKRlNN/Spf1lJImwTaTKb6+gTOtx8JnxrOY++kTbMAg0uz8STwsdvvaZC912sbZNyYb7JpUpQI7QiKt4MJTkW7TzLpeX5b+Fk9mD5hBK/BLSzhI+eUFjqi1BCQ0S+dEdLO9zYH3i+z1UZAxlYnicHzBRvuegsE65QSzUatg/wa3bmUVhLU5wIpTTM0Z0+UWW3NZukMLRs0qP87IiUpgi14d2t6Fqtmr0UaqOpdNucpSaatjSrILhzoedxpoemAd1aj/kJE6VPiz/8Du9gg18kLfvDGEoNqdfwpDmIXrhZ4bCimT6l/GPIZGkq2Jfx+gCMIroeWnIuI7SKM66ahrHT91xnNuqMphrOc8H1cc2wC6uFmzdvI0vMP7vNBBJBDUMTjCX/qlXMohmkhtSKFoe2TQHCckHbL7SpCOe28+0C3GWceyNodmf4YQK8AS35ghhjTzdB7ip7lKnKG36SfpNR6bhOuB0ESp9KsiSibGuYrqJLabYQVOd2RvUVPYMSji4pi8Ui9CzGF83OZxSWXFqW/wnc9RpPQKiDSvA3KkT7LWsXK0xpkpT7mItqySF+dPOGvu8f6hPoWwW9dDlHx9SD+rC5oa65txLEXwDFRAczpeliPV+UUCARm8LUt6OPmERdo8EBVSKjGYqfxoUD66l907If0orJKU0TUsPdZ0w6aTq5oup1pn/eFIQB+Yxm+oTVTUfm91jr6OkHTGy9zg0OSqdksWM79fP0Eb0mTRffGutJaiNCjUDrIU0cf6jpxiF0b8eWwUAomD+xxa8skveFQouyCah6R80BMSWfN6dVO7KbHCRXonsNeMTElppCuPrZUgRfo+OsqY+KKtewNs5VmHxSjRsk5hBj/SOPfl4MUIt16sr6P4U13FBIQSmpjwrivnP/XS7q6y5ayhbWdc3EyvwSKFGbYURhvbYp1V9v3pgou7yk2gpFQ35x+2sYTZsWgrdgUkfz9dylovO13+XEgxxC+aOQ4C/xhDGYf2wrGtL2JC1sp/vMmrap1c8JOOC+FO88rrCYrDQd7N1Ov1x9zg9/GcZAd2cyfgEDtyjjVzDwOp96/x3sb6xOoUrln32aC2HYrnMdWjE44vSCj2fFte74d6zIUNfhBybcKobP/Ijr3Bl0eFKesi4PGRz2mW+m/hsKMCMfHHZ5a7c4O/GY4tgvcaotHdOcYSs3xgKtgPTH0vK+o4ew7UnhNfOnza/2UveajijCONwimo/sGtBcWqrPu/m/g2NoWqUIVrQyCTogRaH2W3EkgrSDarlNW9Gb1nTNw6AAFDCSME2vtbUnQvhOwqbYMHBaQ2/5Ti1oPlBQomGbbgI3QXgMwkXndMKEJhQgBA+NVhBEAW3tFxIbIf32OEVToeFKqtAJjaxFER4a90aoPA/vit3MIJ1SbgvVMIqt36lkTATT/X7/mksZv2Zc5run3SiC8j7WsN4nCr/z+BGveKQJn2S/Bj5U8PC6+v74AvnzdDrdP0cQVvdPm0kMKhjhZ03TECDbrzavpe6ShxExG6WzCUshesphyeosfSwhYzGs2asijccLkiTJ3LqPCS0C2rJ9uh2zbJ68sOlLEhSbp1mZ3+Mtwf00nVVsJCO2yLaLWadaB1DQDACmdyZa5VAzDrqQULI4Xj0HnEZ+zEoAqWlT5TELaGu31wK0KhXexhJMQxNWSgnrzcgE9zM8OWGyxHs0jrZLS/c7cExIOb1TxETJdnlkaMf9cnNf0FYSAi/I4yg2smCJYRUqPltLaaSWSmraQjfcjEAqBSmLDkyYeMXqddGtjepR0PE2r2h0IBOG5i7uApR2wx6N5ugeaS0TozU/26cIkk0hcxZLKZXrIWIJ1yHtgyip4R+ZeN3mMzbmUO4Y2887tasTMrF5pBVwPFptUclv4oTd3pTsMUeBOG2FGbPZvHwoisddmlYsJ325QSpc3ZYlWpn7V1o1CgmLg+fV4xMbo58BCLb334NLS/c7QEG3Zkn7y5BOxGgSbiaPJkMdmOGw8d0FJdzcIDlPjH1jexN/mxYAKgOnE1qRncAxEa1GKrivw5JVnIdke1B5Li3d7wAFzbSq8BcxMWK3ec1q5zvUiEW+tXSBLyw8P3Jfyjkjx8LqdMfm6GJZjcFmuMABVrNdwIMdDpSckQ96TtPVtOiWF/2eaY1BRRjfLyHI/8X+XYVoOQMOwfPYoMUMUHghou9L33Ju9iPQD7eMvWZUpti90P8cLUzv2fc61jx4ztGQLlaByqZ4Sdwp30FthNQUo7jGIHKoFR5h9ER/0CG4djPqKrOuD8+tc9CucZ9icOvTX2p5VwadiXIfQ7ODeBHeLLs2/3NsDSIjOCQatFvXQeet23beNqt3rFCa3nc/dCe+QX6yWeqgmrXXh14j5c5cVrJz4zcSys6v8unRo0ePHj169OjRo0ePHj169OjRo0ePHj169OjRo0ePHj169OjRMfxsx5AvA0/3aOD9xi7o142eiQO8mz8B+eFQfnxHnvzQ7483/OwD6e8PL/zvcV4mJOEgnrwBCSSlbGSWIBuZ24tke9AeN6/wy6EN79zeLPQL76LPaF4c3yGcmYibs44O6Z4VksPmfRGY+OTt6LipXx4BqOYO0Kc3y2ScQTmpg2BcxXI2LgHWWzxfxSodP0A2Sc2sGtfluFoYkHBOnNlOSAgeZBWtITAmjibBMjHmoYBobdZRMZpDPDdQPJgkIorMQwDxWqp4Hc6Lhokog4WZBQDbOE7jDEZFMcbT+STKlmYS55DgfeUWIKgAzkvFeZnQEkZlUOdJmcdBPV9Eszqoszp8Tst0HtyV6zqbFeNsPZsnAZg6K+cv2zweZaOsNqAKut+MYTJJucTbAYpKVYtczbNllESA95R4nayQqbwE2qvjjM9+ZiYA6jSsIEqJiaCGLON3WRpMIK5KmKh0DtUSv9HZPsPvv8arIz6OclOZOoBoYkAXJCakJZgsRSICNYJl9rystrVjIsY/ZY7qNFIAZyXivEzQQA+zvJLrWT6PxnEF2VZNgkDeSllU8aRYLsPxujYmySoTxxNp0jIYr3MzNhUOjxBN7GQt0bzU0SyOEoMvzFhuyzhOsnIbjONUziIzMkjlwzmf2+G8OiElzNIik0FZzPIMv9qijtdJbpaoJZnMZiafRZAl87KIytzMk6VJZwHajQz/uQ94SJJZkNclBEla4IsknNdLJHgeyC3eWtaZjEuQZnvWx3Y4t8WUH+2YPP78vX2T7279/Bknx5//I+fAeUfH8RndQfuyPSnfDpvj45mDeIfj9mZ36u0EvH2klOcn4tx24ijmQQVaoQ6H7VWt5IcXEt6pxIGl4xf/8bY/wsR/AB8JPc+0jdgFAAAAAElFTkSuQmCC';
  const imagePath_6 = 'data:image/png;base64,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';
  const imagePath_7 = 'data:image/jpeg;base64,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';
  const imagePath_8 = 'data:image/png;base64,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';
const doc = new jsPDF();
const userId = this.user?.id || 'Unknown';
const dateStr = new Date().toLocaleString();

const imageWidth = 8; // Image width
const imageHeight = 8; // Image height
const pageWidth = doc.internal.pageSize.width; // Get page width
let y = 55; // Y position for the first section
const caseData = this.caseDataFinal || {};
const botMessage = [...this.chatbotConversation]
  .reverse()
  .find(m => m.senderId === 'medical_bot' && !m.options)?.content || 'No analysis available.';


// Define colors
const headerColor: [number, number, number] = [178, 34, 52]; // Red color for the title
const sectionColor: [number, number, number] = [0, 102, 204]; // Dark Blue for sections
const textColor: [number, number, number] = [0, 0, 0]; // Black for content text

// Logo (Text Logo - MedConnect)
const logoText = 'MedConnect';
doc.setFontSize(40);
doc.setFont('poppins', 'bold');
doc.setTextColor(...headerColor);

const logoWidth = doc.getTextWidth(logoText);
const logoXPos = pageWidth - logoWidth - 10; // Logo positioned on the right edge
doc.text(logoText, logoXPos, 20); // Logo position

// Set up the header
doc.setFontSize(18);
doc.setFont('helvetica', 'bold');
doc.setTextColor(...headerColor);
doc.text('Clinical Case Report', 10, 30);

// Document metadata (user ID and date)
doc.setFontSize(11);
doc.setFont('helvetica', 'normal');
doc.setTextColor(...textColor);
doc.text(`Generated for user ID: ${userId}`, 10, 38);
doc.text(`Date: ${dateStr}`, 10, 44);

// Function to add content sections to the PDF
const addSection = (title: string, content: string, imagePath: string | null = null, color: [number, number, number] = sectionColor) => {
    const imageSpacing = 10; // Space between the image and the title
    const imageVerticalSpacing = 5; // Vertical space between image and text (top and bottom)

    const xPos = 10; // Image placed on the left side of the page
    const titleStartX = xPos + (imagePath ? imageWidth + imageSpacing : 0); // Adjust X position for title based on image width

    // Add image if provided
    if (imagePath) {
        const format = imagePath.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(imagePath, format, xPos, y, imageWidth, imageHeight); // Add image with vertical space
    }

    // Add section title next to the image (on the right side)
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);

    const titleWidth = doc.getTextWidth(title); // Width of the title
    doc.text(title, titleStartX, y + imageVerticalSpacing);  // Title placed just right of the image

    // Adjust the Y position after the image-title block is added
    y = Math.max(y + imageHeight, y + 13) + imageVerticalSpacing;  // Ensure enough space for both image and title

    // Add content under the title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0); // Default text color

    const lines = doc.splitTextToSize(content, 180); // Wrap content text
    lines.forEach((line: string) => {
        if (y >= 270) {  // If we reach the bottom of the page, add a new page
            doc.addPage();
            y = 20; // Reset Y position for new page
        }
        doc.text(line, 10, y);
        y += 6; // Adjust line spacing
    });

    y += 5; // Adjust for spacing between sections
};
const convertHtmlToPlainText = (html: string) => {
  html = html.replace(/<strong>(.*?)<\/strong>/gi, (_, content) => content.toUpperCase());

  html = html
    .replace(/<\/h3>/g, '\n')
    .replace(/<h3>/g, '\n=== ')
    .replace(/<li>/g, '• ')
    .replace(/<\/li>/g, '\n')
    .replace(/<ul>/g, '\n')
    .replace(/<\/ul>/g, '\n')
    .replace(/<p>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]*>/g, '');

  html = html.replace(/\s*\n\s*/g, '\n'); // trim spaces around newlines
  html = html.replace(/\n{2,}/g, '\n\n'); // max two consecutive newlines
  html = html.trim();

  return html;
};
const formattedText = convertHtmlToPlainText(botMessage); 


// Call addSection for each section
addSection('Patient Information', `Age: ${caseData['age'] || 'N/A'}\nSex: ${caseData['sex'] || 'N/A'}`, imagePath_1);
addSection('Chief Complaint', caseData['chiefComplaint'] || 'N/A', imagePath_2);
addSection('Duration', caseData['duration'] || 'N/A', imagePath_3);
addSection('Medical History', caseData['history'] || 'N/A', imagePath_4);
addSection('Risk Factors', caseData['riskFactors'] || 'N/A', imagePath_5);
addSection('Associated Symptoms', caseData['associatedSymptoms'] || 'N/A', imagePath_6);
addSection('Diagnostic Findings', caseData['diagnostics'] || 'N/A', imagePath_7);
addSection('Bot\'s Analysis & Recommendation', formattedText, imagePath_8);


// Footer with generation time
doc.setFontSize(10);
doc.setTextColor(150);
doc.text('Generated using the SmartCardio Assistant • ' + dateStr, 10, 290);

// Save the document as a PDF file
doc.save('Clinical_Case_Report.pdf');


}


handleUserSelection(option: string) {
  console.log('🧠 Option selected:', option);

  if (option === 'case' || option === 'newCase') {
    this.caseDataFinal = {}; // ✅ Clear old report on new case
    this.setMode('case');
  } else if (option === 'question' || option === 'newQuestion') {
    this.caseDataFinal = {}; // ✅ Clear old report on new question
    this.setMode('question');
  } else if (option === 'exit') {
    this.selectedMode = null;
    this.caseData = {};
    this.caseDataFinal = {};
    this.currentCaseStep = -1;
    this.chatbotConversation = [
      ...this.chatbotConversation,
      {
        senderId: 'medical_bot',
        receiverId: this.user?.id || '',
        content: '👋 Thank you! You can come back anytime.',
        status: 'sent',
        timestamp: new Date().toISOString()
      }
    ];
  }
}





objectKeys(obj: any): string[] {
  return Object.keys(obj);
}
checkTodayEvents(events: any[]) {
  const today = new Date();
  const todayStr = today.toDateString();

  const todaysEvents = events.filter(event => {
    if (!event.date) {
      console.warn('⚠️ Event is missing a date:', event);
      return false;
    }

    const eventDateStr = event.date.toDateString();
    return eventDateStr === todayStr;
  });

  console.log('✅ Events matching today\'s date:', todaysEvents);

  if (todaysEvents.length > 0) {
    this.snackBar.open(`📅 You have ${todaysEvents.length} event(s) today!`, 'OK', {
      duration: 10000,
      verticalPosition: 'top',
      panelClass: ['custom-snackbar'],
    });
  } else {
    console.log('📭 No events for today.');
  }
}

  
  
  

ffetchEvents(): void {
  const storedUser = localStorage.getItem('user');
  if (!storedUser) {
    console.error('❌ No user found in localStorage.');
    return;
  }

  const user = JSON.parse(storedUser);
  const userId = user.id;

  this.http.get<CalendarBookingEvent[]>(`http://localhost:5000/events?userId=${userId}`).subscribe({
    next: (events) => {
      if (!events || events.length === 0) {
        this.events = [];
        return;
      }

      this.events = events.map(event => ({
        ...event,
        date: new Date(event.date),
        participantNames: [] as string[]
      }));

      this.events.forEach(event => {
        // We expect userId and doctorId fields for the two participants
        if (event.userId && event.doctorId) {
          this.loadParticipantNamesForTwo(event, event.userId, event.doctorId);
        } else {
          console.warn(`⚠️ Event "${event.title}" missing userId or doctorId.`);
        }
      });
    },
    error: (err) => console.error('❌ Error fetching events:', err)
  });
}

loadParticipantNamesForTwo(event: any, userId: string, doctorId: string) {
  const userRequest = this.http.get<{ name: string }>(`http://localhost:5000/users/${userId}`);
  const doctorRequest = this.http.get<{ name: string }>(`http://localhost:5000/users/${doctorId}`);

  forkJoin([userRequest, doctorRequest]).subscribe({
    next: ([user, doctor]) => {
      event.participantNames = [user.name, doctor.name];
      console.log(`✅ Participant names loaded for event "${event.title}":`, event.participantNames);
    },
    error: (err) => {
      console.error(`❌ Error fetching participant names for event "${event.title}":`, err);
      event.participantNames = [];
    }
  });
}

canJoin(eventDateString: string): boolean {
  const now = new Date();
  const eventTime = new Date(eventDateString); // Convert the string back to a Date object
  const timeDiff = eventTime.getTime() - now.getTime();
  return timeDiff <= 15* 60 * 1000; // Allow join if within 5 minutes before the event starts
}

joinCall(roomId: string, eventDateString: string): void {
  const jitsiUrl = `https://meet.jit.si/${roomId}`;
  window.open(jitsiUrl, '_blank');
}

  onscheduled(): void {
    this.activeSection = 'call'; // Switch to 'call' section
    this.ffetchEvents(); // Fetch events when switching to the 'call' section
  }
 onSendToAllDoctor(){
  this.activeSection="alldoctors"
 }
 addChoice(): void {
  this.choices.push('');
}
 removeChoice(index: number): void {
  if (this.choices.length > 1) {
    this.choices.splice(index, 1);
  }
}
 uploadECGFile_1(): void {
  console.log('Emergency Level:', this.emergencyLevel);

  if (!this.emergencyLevel) {
    this.ecgUploadMessage = 'Please select an emergency level before uploading!';
    return;
  }

  if (!this.selectedECGFile) {
    this.ecgUploadMessage = 'Please select a file first!';
    return;
  }

  const user = localStorage.getItem('user');
  const senderId = user ? JSON.parse(user).id : null;

  if (!senderId) {
    this.ecgUploadMessage = 'Sender ID is missing!';
    return;
  }

  const formData = new FormData();
  formData.append('file', this.selectedECGFile);
  formData.append('emergencyLevel', this.emergencyLevel);

  // ✅ Append diagnosesChoices instead of choices
  formData.append('choices', JSON.stringify(this.diagnosesChoices));

  this.ecgUploadMessage = 'Uploading ECG...';

  this.http.post('http://localhost:5000/upload-ecg-to-all-doctors', formData, {
    headers: {
      'senderId': senderId
    }
  }).subscribe({
    next: (response: any) => {
      console.log('✅ ECG file uploaded successfully', response);
      this.ecgUploadMessage = 'ECG uploaded successfully!';
      this.selectedECGFile = null;
      this.emergencyLevel = '';
      this.diagnosesChoices = [''];  // ✅ Reset diagnoses
    },
    error: (error) => {
      console.error('❌ Error uploading ECG file:', error);
      if (error.status === 400) {
        this.ecgUploadMessage = 'Bad request: Please check the file and IDs.';
      } else if (error.status === 500) {
        this.ecgUploadMessage = 'Server error: Failed to upload ECG.';
      } else {
        this.ecgUploadMessage = 'Unexpected error occurred.';
      }
    }
  });
}

onModify(): void {
  this.activeSection = "drafts";
}

onFileSelected(event: any): void {
  console.log('onFileSelected triggered');
  const file = event.target.files[0];
  console.log('File selected:', file);
  if (file) {
    this.selectedFile_1 = file;
    this.isFileSelected = true;
    this.cd.detectChanges();
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.previewUrl = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
isUploading = false; 
uploadAndModify(): void {
  if (this.isUploading) return;
  this.isUploading = true;

  const user = localStorage.getItem('user');
  const senderId = user ? JSON.parse(user).id : null;

  if (!this.selectedFile_1) {
    this.uploadMessage = 'Veuillez sélectionner une image ECG.';
    this.isUploading = false;
    return;
  }

  this.uploadMessage = 'Envoi du brouillon...';

  const img = new Image();

  img.onload = () => {
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    const previewWidth = 300;
    const scaleFactor = naturalWidth / previewWidth;

    const cropX = this.cropX * scaleFactor;
    const cropY = this.cropY * scaleFactor;
    const cropWidth = this.cropWidth * scaleFactor;
    const cropHeight = this.cropHeight * scaleFactor;

    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Contexte 2D non disponible");
      this.uploadMessage = '❌ Erreur lors du traitement de l’image.';
      this.isUploading = false;
      return;
    }

    ctx.filter = `brightness(${this.brightness}) contrast(${this.contrast}) blur(${this.blur}px)`;

    ctx.drawImage(
      img,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        console.error("Erreur de génération de l'image modifiée.");
        this.uploadMessage = "❌ Erreur de génération de l'image modifiée.";
        this.isUploading = false;
        return;
      }

      const modifiedFile = new File([blob], this.selectedFile_1?.name ?? 'modified.png', {
        type: blob.type
      });

      const formData = new FormData();
      formData.append('file', modifiedFile);
      formData.append('senderId', senderId ?? '');  // <-- userId sent here
      formData.append('brightness', this.brightness.toString());
      formData.append('contrast', this.contrast.toString());
      formData.append('blur', this.blur.toString());
      formData.append('cropX', cropX.toString());
      formData.append('cropY', cropY.toString());
      formData.append('cropWidth', cropWidth.toString());
      formData.append('cropHeight', cropHeight.toString());

      this.http.post('http://localhost:5000/modify-ecg-draft', formData).subscribe({
        next: () => {
          this.uploadMessage = '✅ Brouillon enregistré avec succès.';
          this.cancelEdit();
          this.isUploading = false;
        },
        error: (err) => {
          console.error('Erreur lors de l’envoi du brouillon :', err);
          this.uploadMessage = '❌ Une erreur est survenue.';
          this.isUploading = false;
        }
      });
    }, 'image/png');
  };

  img.onerror = () => {
    this.uploadMessage = '❌ Erreur lors du chargement de l’image.';
    this.isUploading = false;
  };

  const reader = new FileReader();
  reader.onload = (e: any) => {
    img.src = e.target.result;
  };
  reader.readAsDataURL(this.selectedFile_1);
}



triggerTestNotification() {
  const testMessage: Message = {
    senderId: 'test-system',
    receiverId: this.user?.id || 'current-user',
    status: 'sent',
    timestamp: new Date().toISOString(),
    content: 'This is a test notification',
    senderName: 'System'
  };

  console.log('🧪 Triggering test notification:', testMessage);
  alert('Triggering test notification'); // TEMP for testing

  this.showNotification(testMessage);
}


get filterStyle(): string {
  return `brightness(${this.brightness}) contrast(${this.contrast}) blur(${this.blur}px)`;
}

get clipStyle(): string {
  return `inset(${this.cropY}px ${300 - (this.cropX + this.cropWidth)}px ${300 - (this.cropY + this.cropHeight)}px ${this.cropX}px)`;
}

cancelEdit(): void {
  this.selectedFile_1 = null;      // Reset selectedFile_1 if you're using it
  this.previewUrl = null;
  this.isFileSelected = false;
  this.uploadMessage = '';
  this.brightness = 1;
  this.contrast = 1;
  this.blur = 0;
  this.cropX = 0;
  this.cropY = 0;
  this.cropWidth = 300;
  this.cropHeight = 300;
}
onseedrafts(): void {
  this.activeSection = 'see_drafts';
  this.fetchDrafts();
}
viewFile(filename: string): void {
  const url = `http://localhost:5000/drafts/${filename}`;
  window.open(url, '_blank');
}

downloadFile(filename: string): void {
  const url = `http://localhost:5000/drafts/${filename}`;
  console.log(`Initiating download for: ${filename} from ${url}`);

  this.http.get(url, { responseType: 'blob' }).subscribe(
    (response) => {
      console.log(`Received Blob response for: ${filename}`, response);

      // Create Blob object and trigger download
      const blob = new Blob([response], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;

      // Triggering download
      console.log(`Triggering download for: ${filename}`);
      link.click();
      console.log(`Download initiated for: ${filename}`);
    },
    (error) => {
      console.error(`Error during download of ${filename}:`, error);
    }
  );
}

fetchDrafts(): void {
  const userData = localStorage.getItem('user');
  const senderId = userData ? JSON.parse(userData).id : null;

  if (!senderId) {
    console.error('❌ Aucun ID utilisateur trouvé pour récupérer les brouillons.');
    return;
  }

  this.http.get<any[]>(`http://localhost:5000/user-drafts/${senderId}`).subscribe({
    next: (drafts) => {
      if (!Array.isArray(drafts)) {
        console.error('❌ Réponse invalide des brouillons :', drafts);
        this.userDrafts = [];
        return;
      }

      // Ensure each draft has a valid URL and filename
      this.userDrafts = drafts.map(draft => {
        // Check if draft has the necessary properties before processing
        if (!draft || !draft.filename || !draft.url) {
          console.warn('⛔️ Brouillon avec données incomplètes:', draft);
          return null;  // Skip invalid drafts
        }

        // Ensure proper URL formatting
        const fixedUrl = draft.url.includes('http://localhost:5000/drafts/')
          ? draft.url
          : `http://localhost:5000/drafts/${draft.filename.replace(/\\/g, '/')}`;

        return {
          ...draft,
          url: fixedUrl // Ensure URL is properly set for download
        };
      }).filter(Boolean); // Remove any nulls (invalid drafts)

      // Check if there are valid drafts
      if (this.userDrafts.length === 0) {
        console.warn('⚠️ Aucun brouillon valide trouvé pour l\'utilisateur.');
      } else {
        console.log("✅ Brouillons chargés :", this.userDrafts);
      }
    },
    error: (err) => {
      console.error('⚠️ Erreur lors du chargement des brouillons :', err);
      this.userDrafts = [];
    }
  });
}

deleteDraft(draftId: string): void {
  console.log('ID du brouillon à supprimer:', draftId);

  if (!draftId) {
    console.error('❌ ID manquant pour la suppression');
    return;
  }

  const user = localStorage.getItem('user');
  const userId = user ? JSON.parse(user).id : null;

  this.http.delete(`http://localhost:5000/drafts/${draftId}?userId=${userId}`).subscribe({
    next: () => {
      console.log('✅ Brouillon supprimé avec succès');
      this.userDrafts = this.userDrafts.filter(d => d._id !== draftId);
    },
    error: (err) => {
      console.error('⚠️ Erreur lors de la suppression:', err);
    }
  });
}


onsendcase(event: Event, index: number, doctor: any): void {
  this.activeSection = 'send-case';
  console.log('📤 Send case clicked - Index:', index, 'Doctor ID:', doctor._id);
  this.selectedDoctorId = doctor._id;
}
safeAppend(formData: FormData, key: string, value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    formData.append(key, '');
  } else {
    formData.append(key, value.toString());
  }
}
logCurrentValues() {
  console.log({
    patientId: this.patientId,
    patientAge: this.patientAge,
    patientSex: this.patientSex,
    consultationMotive: this.consultationMotive,
    symptoms: this.symptoms,
    medicalHistory: this.medicalHistory,
    allergies: this.allergies,
    currentMedications: this.currentMedications,
    bloodPressure: this.bloodPressure,
    heartRate: this.heartRate,
    temperature: this.temperature,
    oxygenSaturation: this.oxygenSaturation,
    selectedECGFile: this.selectedECGFile,
  });
}
handleECGFileSelection(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    this.selectedECGFile = input.files[0];
    console.log('Selected ECG file:', this.selectedECGFile);
  } else {
    this.selectedECGFile = null;
  }
}


sendFullCase(caseForm: any) {
  if (!caseForm.valid) {
    this.caseSubmissionMessage = "Please fill in all required fields correctly.";
    return;
  }

  this.logCurrentValues();

  const user = localStorage.getItem('user');
  let senderId = '';
  if (user) {
    try {
      senderId = JSON.parse(user)?.id || '';
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }

  

  const formData = new FormData();

  this.safeAppend(formData, 'senderId', senderId);
  this.safeAppend(formData, 'receiverId', this.selectedDoctorId);
  this.safeAppend(formData, 'patientId', this.patientId);
  this.safeAppend(formData, 'patientAge', this.patientAge?.toString());
  this.safeAppend(formData, 'patientSex', this.patientSex);
  this.safeAppend(formData, 'consultationMotive', this.consultationMotive);
  this.safeAppend(formData, 'symptoms', this.symptoms);
  this.safeAppend(formData, 'medicalHistory', this.medicalHistory);
  this.safeAppend(formData, 'allergies', this.allergies);
  this.safeAppend(formData, 'currentMedications', this.currentMedications);
  this.safeAppend(formData, 'bloodPressure', this.bloodPressure);
  this.safeAppend(formData, 'heartRate', this.heartRate?.toString());
  this.safeAppend(formData, 'temperature', this.temperature?.toString());
  this.safeAppend(formData, 'oxygenSaturation', this.oxygenSaturation?.toString());

  if (this.selectedECGFile) {
    formData.append('selectedECGFile', this.selectedECGFile, this.selectedECGFile.name);
  } else {
    console.warn('No ECG file selected');
  }

  this.http.post('http://localhost:5000/cases', formData).subscribe({
    next: () => {
      this.caseSubmissionMessage = "Case submitted successfully!";
      caseForm.resetForm();
      this.selectedECGFile = null;
    },
    error: (error) => {
      console.error("Submission error:", error);
      this.caseSubmissionMessage = "Error submitting the case.";
    }
  });
}
onseerespondedcase(event: Event, index: number, doctor: any): void {
  this.activeSection='getresponse';
  this.fetchRespondedCases();


}
fetchRespondedCases(): void {
  const user = localStorage.getItem('user');
  let senderId = '';
  if (user) {
    try {
      senderId = JSON.parse(user)?.id || '';
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }

  this.http.get<any[]>('http://localhost:5000/api/cases/responded').subscribe({
    next: (data) => {
      console.log('Fetched responded cases:', data);
      // 🧠 Filter where senderId and receiverId match
      this.cases = data.filter(c =>
        c.senderId === senderId && c.receiverId === this.selectedDoctorId
      );
    },
    error: (err) => {
      console.error('Failed to fetch responded cases', err);
    }
  });
}
onseerespondedecg(event: Event, index: number, doctor: any): void {
  this.activeSection='getresponse_1';
  console.log('go to get response of ecgs');
  this.fetchMyECGs();
  


}
fetchMyECGs(): void {
  const user = localStorage.getItem('user');
  let senderId = '';
  
  if (user) {
    try {
      senderId = JSON.parse(user)?.id || '';
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }

  this.http.get<any[]>('http://localhost:5000/api/ecgs').subscribe({
    next: (data) => {
      console.log('Fetched ECGs:', data);
      // ✅ Filter only ECGs sent by the current user
      this.ecgs = data.filter(ecg => ecg.senderId === senderId && ecg.receiverId === this.selectedDoctorId);
    },
    error: (err) => {
      console.error('Failed to fetch ECGs', err);
    }
  });
}
extractFilename(filePath: string): string {
  // This works for Windows-style paths
  return filePath.split('\\').pop() || '';
}
fetchAllECGs(): void {
  const user = localStorage.getItem('user');
  let senderId = '';
  if (user) {
    try {
      senderId = JSON.parse(user)?.id || '';
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }

  if (!senderId) {
    console.error('No senderId found.');
    return;
  }

  this.http.get<any[]>('http://localhost:5000/api/ecgs/all').subscribe({
    next: (data) => {
      console.log('✅ All ECGs fetched:', data);
      // 🧠 Filter ECGs by senderId only
      this.all_ecgs = data.filter(ecg => ecg.senderId === senderId);
    },
    error: (err) => {
      console.error('❌ Failed to fetch all ECGs:', err);
    }
  });
  
    
  }
  onAnsweredEcgs(){
    this.activeSection='getresponse_2';
    this.fetchAllECGs();}
    onSendCaseToAllDoctor(): void {
      this.activeSection = 'submit-full-case';
    }
    submitPatientCase(form: NgForm): void {
      if (!form.valid) {
        this.caseSubmissionMessage = "Please fill in all required fields correctly.";
        return;
      }
    
      this.logCurrentValues?.(); // Optional: Only call if defined
    
      const user = localStorage.getItem('user');
      let senderId = '';
      if (user) {
        try {
          senderId = JSON.parse(user)?.id || '';
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
    
      const formData = new FormData();
    
      // Append core patient and case info
      this.safeAppend(formData, 'senderId', senderId);
      this.safeAppend(formData, 'patientId', this.patientId);
      this.safeAppend(formData, 'patientAge', this.patientAge?.toString());
      this.safeAppend(formData, 'patientSex', this.patientSex);
      this.safeAppend(formData, 'consultationMotive', this.consultationMotive);
      this.safeAppend(formData, 'symptoms', this.symptoms);
      this.safeAppend(formData, 'medicalHistory', this.medicalHistory);
      this.safeAppend(formData, 'allergies', this.allergies);
      this.safeAppend(formData, 'currentMedications', this.currentMedications);
      this.safeAppend(formData, 'bloodPressure', this.bloodPressure);
      this.safeAppend(formData, 'heartRate', this.heartRate?.toString());
      this.safeAppend(formData, 'temperature', this.temperature?.toString());
      this.safeAppend(formData, 'oxygenSaturation', this.oxygenSaturation?.toString());
    
      // Append diagnoses choices array as JSON string
      formData.append('diagnosesChoices', JSON.stringify(this.diagnosesChoices));
    
      // Handle optional ECG file
      if (this.selectedECGFile) {
        formData.append('broadcastECGFile', this.selectedECGFile, this.selectedECGFile.name);
      } else {
        console.warn('No ECG file selected');
      }
    
      // Send to new endpoint (broadcast to all doctors)
      this.http.post('http://localhost:5000/cases/broadcast', formData).subscribe({
        next: () => {
          this.caseSubmissionMessage = "Case sent to all doctors successfully!";
          form.resetForm();
          this.selectedECGFile = null;
        },
        error: (error) => {
          console.error("Error broadcasting case:", error);
          this.caseSubmissionMessage = "Error sending the case to doctors.";
        }
      });
    }
    
    addDiagnosis() {
      this.diagnosesChoices.push('');
    }
    
    removeDiagnosis(index: number) {
      this.diagnosesChoices.splice(index, 1);
    }
    onseeansweredqueries(){
      this.activeSection='getresponse_3';
      this.fetchRespondedALLCases();
    }
    fetchRespondedALLCases(){
      const user = localStorage.getItem('user');
  let senderId = '';
  if (user) {
    try {
      senderId = JSON.parse(user)?.id || '';
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }

  this.http.get<any[]>('http://localhost:5000/api/cases/respondedallcases').subscribe({
    next: (data) => {
      console.log('Fetched responded cases:', data);
      // 🧠 Filter where senderId and receiverId match
      this.all_cases = data.filter(c =>
        c.senderId === senderId 
      );
    },
    error: (err) => {
      console.error('Failed to fetch responded cases', err);
    }
  });

    }
    
    fetchAllReports() {
      const user = localStorage.getItem('user');
      let userId = '';
      if (user) {
        try {
          userId = JSON.parse(user)?.id || '';
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
    
      this.http.get<any[]>(`http://localhost:5000/api/reports?userId=${userId}`).subscribe({
        next: (data) => {
          this.allReports = data;
        },
        error: (err) => {
          console.error('Failed to fetch reports:', err);
        }
      });
    }
    
    onSeeTreatedReports() {
      this.activeSection = 'treatedReports';
      this.fetchAllReports();
    }
    
    viewResponse(report: any) {
      this.selectedReportResponse = report.response;
    }
    
    closeResponse() {
      this.selectedReportResponse = null;
    }
  onreportseccurity() {
  this.activeSection = 'securityReport';

  // ✅ Try restoring form if saved previously
  const saved = localStorage.getItem('savedSecurityReportForm');
  if (saved) {
    try {
      const parsedForm = JSON.parse(saved);
      this.securityReportForm.patchValue(parsedForm);
   
      console.log('📝 Restored saved form from localStorage');
    } catch (e) {
      console.error('❌ Failed to parse saved form:', e);
    }
  }
}

onSubmit_1() {
  if (this.securityReportForm.valid) {
    const formData = this.securityReportForm.value;

    // Get userId from localStorage
    const userId = (() => {
      try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user)?.id || '' : '';
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
        return '';
      }
    })();

    // Include userId in the formData
    const payload = { ...formData, userId };

    this.http.post('http://localhost:5000/api/security-report', payload).subscribe({
      next: (response) => {
        console.log('Form submitted successfully:', response);

        this.submissionSuccess = true;
        this.securityReportForm.reset();

        // ✅ Clean up localStorage
        localStorage.removeItem('savedSecurityReportForm');

        this.activeSection = 'submissionSuccess';
      },
      error: (error) => {
        console.error('Submission failed:', error);
        // Optionally show error to user
      }
    });
  } else {
    this.securityReportForm.markAllAsTouched(); // Show validation errors
  }
}

  goTo(path: string): void {
  console.log('Navigating to:', path);

  // ✅ Save current form data before navigation
  const formData = this.securityReportForm.getRawValue();
  localStorage.setItem('savedSecurityReportForm', JSON.stringify(formData));

  // Navigate to path
  this.router.navigate(['/' + path]).then(success => {
    console.log('Navigation success?', success);
  });

  const controlName = path === 'change-password' ? 'changePassword'
                    : path === 'enable-2fa' ? 'enable2FA'
                    : path === 'support-chat' ? 'contactSupport'
                    : path === 'account-activity' ? 'monitorActivity'
                    : null;

  if (controlName) {
    this.securityReportForm.get(`actions.${controlName}`)?.setValue(true);
    console.log(`Set form control actions.${controlName} to true`);
  }
}

    
    
    learnMore(topic: string): void {
      this.router.navigate([`/help/${topic}`]);
      if (topic === 'sharing-guidelines') {
        this.securityReportForm.get('actions.avoidSharing')?.setValue(true);
      }
    }
approveDiagnosis(c: any) {
  c.generalistDecision = 'Approved';
  this.sendDecisionToBackend(c);
}

disapproveDiagnosis(c: any) {
  c.generalistDecision = 'Disapproved';
  this.sendDecisionToBackend(c);
}

sendDecisionToBackend(c: any) {
  const payload = {
    id: c._id,  // Use this to identify the ECG on the backend
    decision: c.generalistDecision
  };

  this.http.post('http://localhost:5000/api/generalist-decision', payload)
    .subscribe({
      next: (res) => {
        console.log('Decision saved:', res);
      },
      error: (err) => {
        console.error('Error saving decision:', err);
      }
    });
  }
approveDiagnosis_1(c: any) {
  c.generalistDecision = 'Approved';
  this.sendDecisionToBackend_1(c);
}

disapproveDiagnosis_1(c: any) {
  c.generalistDecision = 'Disapproved';
  this.sendDecisionToBackend_1(c);
}

sendDecisionToBackend_1(c: any) {
  const payload = {
    id: c._id,  // Use this to identify the ECG on the backend
    decision: c.generalistDecision
  };

  this.http.post('http://localhost:5000/api/generalist-decision_1', payload)
    .subscribe({
      next: (res) => {
        console.log('Decision saved:', res);
      },
      error: (err) => {
        console.error('Error saving decision:', err);
      }
    });
}
approveDiagnosis_2(c: any) {
  c.generalistDecision = 'Approved';
  this.sendDecisionToBackend_2(c);
}

disapproveDiagnosis_2(c: any) {
  c.generalistDecision = 'Disapproved';
  this.sendDecisionToBackend_2(c);
}

sendDecisionToBackend_2(c: any) {
  const payload = {
    id: c._id,  // Use this to identify the ECG on the backend
    decision: c.generalistDecision
  };

  this.http.post('http://localhost:5000/api/generalist-decision_2', payload)
    .subscribe({
      next: (res) => {
        console.log('Decision saved:', res);
      },
      error: (err) => {
        console.error('Error saving decision:', err);
      }
    });
}
approveDiagnosis_3(c: any) {
  c.generalistDecision = 'Approved';
  this.sendDecisionToBackend_3(c);
}

disapproveDiagnosis_3(c: any) {
  c.generalistDecision = 'Disapproved';
  this.sendDecisionToBackend_3(c);
}

sendDecisionToBackend_3(c: any) {
  const payload = {
    id: c._id,  // Use this to identify the ECG on the backend
    decision: c.generalistDecision
  };

  this.http.post('http://localhost:5000/api/generalist-decision_3', payload)
    .subscribe({
      next: (res) => {
        console.log('Decision saved:', res);
      },
      error: (err) => {
        console.error('Error saving decision:', err);
      }
    });
}


  faqs: any[] = [];
  submitted = false;
  newQuestion = '';
onFAQ() {
    this.activeSection = 'FAQ';
    console.log('log FAQ');

    // 👇 GET request to fetch FAQs from your backend
    this.http.get<any[]>('http://localhost:5000/api/faqs').subscribe(
      data => {
        this.faqs = data.map(faq => ({ ...faq, open: false }));
        console.log('Fetched FAQs:', this.faqs);
      },
      error => {
        console.error('Failed to load FAQs:', error);
      }
    );
  }

  toggleFaq(index: number): void {
    this.faqs.forEach((faq, i) => {
      faq.open = i === index ? !faq.open : false;
    });
  }

  submitQuestion(): void {
  const trimmedQuestion = this.newQuestion.trim();
  if (trimmedQuestion) {
    const body = { question: trimmedQuestion };

    this.http.post('http://localhost:5000/api/faqs', body).subscribe({
      next: response => {
        console.log('New FAQ submitted:', response);
        this.submitted = true;
        this.newQuestion = '';
      },
      error: error => {
        console.error('Error submitting FAQ:', error);
      }
    });
  }
}
onNotification() {
  this.activeSection = 'notification';
  this.fetchNotifications();
}

 fetchNotifications() {
  console.log('Starting fetchNotifications()');

  const userString = localStorage.getItem('user');
  console.log('Raw user data from localStorage:', userString);

  if (!userString) {
    console.error('No user data found in localStorage');
    return;
  }

  const user = JSON.parse(userString);
  console.log('Parsed user object:', user);

  const userId = user.id || user._id;
  console.log('Extracted userId:', userId);

  if (!userId) {
    console.error('No user ID found in parsed user object');
    return;
  }

  const url = `http://localhost:5000/api/notifications?userId=${userId}`;
  console.log('Request URL:', url);

  this.http.get<Notification[]>(url).subscribe({
    next: (data) => {
      console.log('Notifications fetched successfully:', data);
      this.notifications = data;
    },
    error: (err) => {
      console.error('Error fetching notifications', err);
    }
  });
}


extractEcgId(message: string): string {
  const match = message.match(/ID (\w+)/);
  if (!match) {
    console.warn('No ECG ID found in message:', message);
    return '';
  }
  return match[1];
}
async handleResubmitByType(notification: any) {
  console.log('[🔁 Resubmission Started]', notification);

  if (!notification?.type || !notification?.refId) {
    console.error('[❌] Notification is missing type or refId:', notification);
    return;
  }

  const normalizedType = notification.type.toLowerCase();
  console.log('[ℹ️] Normalized type:', normalizedType);

  const urlMap: { [key: string]: string } = {
    ecg: `http://localhost:5000/api/ecgs_pfe/${notification.refId}`,
    case: `http://localhost:5000/api/cases_pfe/${notification.refId}`
  };

  const url = urlMap[normalizedType];
  if (!url) {
    console.error('[❌] Unknown notification type:', notification.type);
    return;
  }
  console.log('[🌐] Fetching document from URL:', url);

  try {
    const response: any = await this.http.get(url).toPromise();
    console.log('[✅] Received response:', response);

    if (!response || (!response.case && !response.ecg && !response.normalizedScope)) {
      console.error('[❌] Invalid or incomplete response from server:', response);
      return;
    }

    const normalizedScope = response.normalizedScope?.toLowerCase();
    console.log('[ℹ️] Normalized scope:', normalizedScope);

    const resubmitId = notification.refId;

    let resubmitUrl = '';

    if (normalizedType === 'ecg') {
      resubmitUrl = normalizedScope === 'individual'
        ? `http://localhost:5000/api/individual-ecgs/${resubmitId}/resubmit`
        : `http://localhost:5000/api/ecgs/${resubmitId}/resubmit`;
    } else if (normalizedType === 'case') {
      resubmitUrl = normalizedScope === 'individual'
        ? `http://localhost:5000/api/individual-cases/${resubmitId}/resubmit`
        : `http://localhost:5000/api/cases/${resubmitId}/resubmit`;
    }

    if (!resubmitUrl) {
      console.error('[❌] Could not determine resubmit URL:', { normalizedType, normalizedScope });
      return;
    }
    console.log('[🚀] Sending resubmission POST request to:', resubmitUrl);

    this.http.post(resubmitUrl, {}).subscribe({
      next: (res) => {
        console.log(`[✅] ${notification.type} resubmitted successfully:`, res);
        this.markNotificationRead(notification._id);
      },
      error: (err) => {
        console.error(`[❌] Error resubmitting ${notification.type}:`, err);
      }
    });

  } catch (error) {
    console.error('[❌] Failed to fetch document for resubmission:', error);
  }
}


markNotificationRead(notificationId: string) {
  this.http.post(`http://localhost:5000/api/notifications/${notificationId}/read`, {}).subscribe({
    next: () => {
      console.log('Notification marked as read');
      this.notifications = this.notifications.filter(n => n._id !== notificationId);
    },
    error: (err) => {
      console.error('Failed to mark notification as read', err);
    }
  });
}
onintrprt() {
  this.activeSection = 'AI';
}

onFileSelected2(event: any) {
  this.selectedFile2 = event.target.files[0];
}
cancelEvent(event: any): void {
  const userId = this.user?.id; // get current user ID

  this.http.put(`http://localhost:5000/events/${event._id}/cancel?userId=${userId}`, {}).subscribe({
    next: (res) => {
      this.events = this.events.map(e =>
        e._id === event._id ? { ...e, cancelled: 'yes' } : e
      );
    },
    error: (err) => {
      console.error('Error cancelling event:', err);
    }
  });
}

deleteEvent(event: CalendarBookingEvent): void {
  const userId = this.user?.id; // get user ID from your component context

  this.http.delete(`http://localhost:5000/events/${event._id}?userId=${userId}`).subscribe({
    next: () => {
      this.events = this.events.filter(e => e._id !== event._id);
      console.log(`🗑️ Event "${event.title}" deleted.`);
    },
    error: (err) => {
      console.error('❌ Failed to delete event:', err);
    }
  });
}

   onUpload2(): void {
  if (!this.selectedFile2) return;

  // Increment AI usage count (track user attempt)
  this.http.post('http://localhost:5000/api/ai-usage/increment', {}).subscribe(
    (countRes: any) => {
      console.log('AI usage incremented. Current count:', countRes.count);
    },
    (err) => {
      console.error('Failed to increment AI usage count:', err);
    }
  );

  // Set loading to true when starting the upload
  this.loading = true;

  const formData = new FormData();
  formData.append('file', this.selectedFile2, this.selectedFile2.name);

  this.http.post<any>('http://localhost:3000/predict', formData).subscribe(
    (res) => {
      this.loading = false; // Set loading to false when the request is complete

      // Log the full response to check if the fields are correct
      console.log(res);

      // Choose the predicted class based on the response
      const predictedClass = res.predicted_class || res.predicted_class_custom_model;

      // Map the predicted class to a human-readable result
      this.result1 = this.mapPrediction(predictedClass);

      // Capture the Grad-CAM image URL from the backend response
      this.gradcamImage = res.grad_cam_output || res.gradcamImageUrl;

      // Show a success message
      this.snackBar.open('Prediction completed successfully!', 'Close', {
        duration: 3000,
      });
    },
    (err) => {
      this.loading = false; // Hide loading spinner on error
      console.error('Upload failed:', err);

      // Show error message
      this.snackBar.open('Error during processing. Please try again.', 'Close', {
        duration: 3000,
      });
    }
  );
}

  // Map predicted class to corresponding label
  mapPrediction(predictedClass: number): string {
    const classMap: { [key: number]: string } = {
      0: 'Normal Person',
      1: 'Myocardial Infarction (MI)',
      2: 'History of MI (STTC)',
      3: 'Abnormal Heartbeat (CD)',
    };
    return classMap[predictedClass] || 'Unknown Condition';
  }

  // Toggle Grad-CAM visibility
  showGradCam() {
    this.gradcamVisible = !this.gradcamVisible;
  }
}