import { http, withQuery } from "./client";

// Matches FastAPI routes: /api/courses
export const CoursesAPI = {
  list: (params) => http.get(withQuery("/api/courses", params)),
  create: (payload) => http.post("/api/courses", payload),
  update: (id, payload) => http.put(`/api/courses/${id}`, payload),
  remove: (id) => http.del(`/api/courses/${id}`),
};
