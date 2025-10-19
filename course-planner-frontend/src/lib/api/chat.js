import { http } from './client';

export const ChatAPI = {
  send: (message) => http.post('/chat', { message }), // expects { reply: string }
  // history: () => http.get('/chat/history'),
};
