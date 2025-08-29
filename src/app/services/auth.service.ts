import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private socket!: Socket;
  private readonly SERVER_URL = 'http://localhost:5000';

  private forceLogoutSubject = new Subject<{ reason: string }>();

  constructor() {}
  getUser() {
  const userJson = localStorage.getItem('user');
  return userJson ? JSON.parse(userJson) : null;
}

  connectSocket(userId: string) {
    if (this.socket && this.socket.connected) {
      return; // Already connected
    }

    this.socket = io(this.SERVER_URL, {
      query: { userId },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log(`Socket connected: id=${this.socket.id}`);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: reason=${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('force-logout', (data: { reason: string }) => {
      console.log('Received force-logout event:', data);
      this.forceLogoutSubject.next(data);
    });
  }

  onForceLogout(): Observable<{ reason: string }> {
    return this.forceLogoutSubject.asObservable();
  }

  login(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
    this.connectSocket(user.id);
  }

  logout() {
    console.log('Logging out user, clearing storage and disconnecting socket');
    localStorage.clear();
    sessionStorage.clear();
    if (this.socket) {
      this.socket.disconnect();
      console.log('Socket disconnected on logout');
    }
  }
}
