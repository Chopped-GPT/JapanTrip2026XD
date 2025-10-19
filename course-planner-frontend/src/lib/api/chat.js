import { http } from "./client";

// Hook this to your “preferences extraction” stub
export const ChatAPI = {
  // Send free text; backend returns normalized JSON (or a stub today)
  send: (text) => http.post("/api/nlp/preferences", { text }),
  // history: () => http.get('/api/chat/history'), // optional later
};
