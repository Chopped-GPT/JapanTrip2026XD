// src/lib/api/chat.js
import { http } from "./client";

// Uses our mock router's scripted replies.
export const ChatAPI = {
  send: (text) => http.post("/api/nlp/preferences", { text }),
};
