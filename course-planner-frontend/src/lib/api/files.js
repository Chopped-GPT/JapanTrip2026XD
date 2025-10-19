import { http } from "./client";

// Matches FastAPI route: POST /api/uploads/pdf (field name: "file")
export const FilesAPI = {
  uploadPdf: (file, meta = {}) => http.upload("/api/uploads/pdf", file, meta),
};
