import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket!: Socket;
  private readonly SERVER_URL = 'http://localhost:5000'; // Your backend URL

  constructor() {}

  connect(userId: string) {
   this.socket = io(this.SERVER_URL, {
  query: { userId },
  transports: ['websocket', 'polling']  // try websocket first, fallback to polling
});

  }

  joinRoom(room: string) {
    this.socket.emit('joinRoom', room);
  }

  sendMessage(message: any) {
  this.socket.emit('sendMessage', message);
}


  receiveMessages(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('receiveMessage', (message) => {
        observer.next(message);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
  // chat.service.ts

getChatHistory(userId: string, otherUserId: string) {
  this.socket.emit('getChatHistory', { userId, otherUserId });
}
  onChatHistory(): Observable<any[]> {
    return new Observable(observer => {
      this.socket.on('chatHistory', (messages: any[]) => {
        observer.next(messages);
      });
    });
  }

markAsRead(data: { senderId: string; receiverId: string }) {
  this.socket.emit('markAsRead', {
    doctorId: data.senderId,
    userId: data.receiverId
  });
}
onMessagesRead(): Observable<{ by: string }> {
  return new Observable(observer => {
    this.socket.on('messagesRead', (data) => {
      observer.next(data);
    });
  });
}

typing(senderId: string, receiverId: string) {
  this.socket.emit('typing', { senderId, receiverId });
}

stopTyping(senderId: string, receiverId: string) {
  this.socket.emit('stopTyping', { senderId, receiverId });
}

onTyping(): Observable<{ senderId: string }> {
  return new Observable(observer => {
    this.socket.on('typing', (data) => observer.next(data));
  });
}

onStopTyping(): Observable<{ senderId: string }> {
  return new Observable(observer => {
    this.socket.on('stopTyping', (data) => observer.next(data));
  });
}
callUser(
  targetSocketId: string,
  offer: RTCSessionDescriptionInit,
  callerName: string,
  callerUserId: string,             // ✅ add caller ID
  callType: 'voice' | 'video'
) {
  this.socket.emit('callUser', {
    targetSocketId,
    offer,
    callerName,
    callerUserId,                   // ✅ include user ID in payload
    callType
  });
}


// Listen for incoming call offer
onCallMade(): Observable<{
  offer: RTCSessionDescriptionInit;
  socketId: string;
  callerName: string;
  callerUserId: string;                  // ✅ include userId
  callType: 'voice' | 'video';
}> {
  return new Observable(observer => {
    this.socket.on('callMade', (data) => {
      console.log("📥 Incoming call payload:", data); // Debug
      observer.next(data);
    });
  });
}



// Emit answer to caller
makeAnswer(targetSocketId: string, answer: RTCSessionDescriptionInit, callType: 'voice' | 'video') {
  this.socket.emit('makeAnswer', { targetSocketId, answer, callType });
}


// Listen for call answer
onAnswerMade(): Observable<{ answer: RTCSessionDescriptionInit; socketId: string; callType?: 'voice' | 'video' }> {
  return new Observable(observer => {
    this.socket.on('answerMade', (data) => observer.next(data));
  });
}


// Emit ICE candidate
sendIceCandidate(targetSocketId: string, candidate: RTCIceCandidateInit) {
  this.socket.emit('iceCandidate', { targetSocketId, candidate });
}

// Listen for ICE candidates
onIceCandidate(): Observable<{ candidate: RTCIceCandidateInit; socketId: string }> {
  return new Observable(observer => {
    this.socket.on('iceCandidate', (data) => observer.next(data));
  });
}



// Emit reject call
rejectCall(targetUserId: string, targetSocketId?: string) {
  console.log('➡️ Emitting rejectCall:', { targetUserId, targetSocketId });
  this.socket.emit('rejectCall', {
    targetUserId,
    ...(targetSocketId && { targetSocketId })
  });
}

// Listen for rejection
onCallRejected(): Observable<{ socketId: string }> {
  return new Observable(observer => {
    this.socket.on('callRejected', (data) => observer.next(data));
  });
}
// Emit hang up event
// Emit hang-up event
hangUp(targetSocketId: string, callType: 'voice' | 'video' | null = null) {
  console.log(`🚫 Emitting hangUp to ${targetSocketId}, callType: ${callType}`);
  this.socket.emit('hangUp', { targetSocketId, callType });
}


// Listen for hang-up event


// Listen for call ended
onCallEnded(): Observable<{ socketId: string }> {
  return new Observable(observer => {
    this.socket.on('callEnded', (data) => observer.next(data));
  });
}
cancelCall(targetSocketId: string) {
  console.log(`🚫 Emitting cancelCall to ${targetSocketId}`);
  this.socket.emit('cancelCall', { targetSocketId }); // ✅ send as object
}


onCallCanceled(): Observable<{ socketId: string }> {
  return new Observable(observer => {
    this.socket.on('callCanceled', data => observer.next(data));
  });
}

// Listen for call acceptance
onCallAccepted(): Observable<{ socketId: string }> {
  return new Observable(observer => {
    this.socket.on('callAccepted', (data) => observer.next(data));
  });
}
emitCallAccepted(targetSocketId: string, callType: 'voice' | 'video') {
  this.socket.emit('callAccepted', { targetSocketId, callType });
}


listenToCallReminders(
  showInAppNotification: (msg: string) => void,
  showToast: (msg: string, options?: any) => void
) {
  this.socket.on('reminder_1h', (payload) => {
    console.log('📅 Received 1h reminder payload:', payload);
    const { date } = payload;
    showInAppNotification(`📅 Reminder: You have a scheduled call at ${new Date(date).toLocaleTimeString()}`);
  });

  this.socket.on('reminder_10m', (payload) => {
    console.log('⏰ Received 10m reminder payload:', payload);
    const { date } = payload;
    showToast(`⏰ Your call starts at ${new Date(date).toLocaleTimeString()}`, { sound: true });
  });
}
// chat.service.ts

// Add this method in ChatService
onForceLogout(): Observable<{ reason: string }> {
  return new Observable(observer => {
    this.socket.on('force-logout', (data) => {
      observer.next(data);
    });
  });
}


}