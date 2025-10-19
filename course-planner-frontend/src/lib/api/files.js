// src/lib/api/files.js
import { http } from "./client";

// Mock returns a fake id and stores metadata in localStorage.
export const FilesAPI = {
  uploadPdf: (file, meta = {}) => http.upload("/api/uploads/pdf", file, meta),
};
