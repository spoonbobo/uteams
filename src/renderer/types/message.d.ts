export interface Message {
    id: string;
    bettingSessionId: string;
    text: string;
    sender: 'user' | 'companion';
    timestamp: Date;
    type?: 'normal' | 'thinking';
}