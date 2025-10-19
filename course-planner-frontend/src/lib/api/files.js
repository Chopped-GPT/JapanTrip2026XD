import { http } from './client';

export const FilesAPI = {
  uploadPdf: (file, meta = {}) => http.upload('/upload-pdf', file, meta),
};
