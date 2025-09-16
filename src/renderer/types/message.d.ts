export type ChatMessage = {
  id: string;
  chatId: string; // betting session id
  text: string;
  sender: 'user' | 'companion';
  createdAt: string; // ISO string
  isRead?: boolean;
  type?: 'normal' | 'thinking';
};

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  autoHideDuration?: number;
  showProgress?: boolean;
  progress?: number;
}
