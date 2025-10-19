import { http, withQuery } from './client';

// Adjust paths/params to match your FastAPI docs later
export const CoursesAPI = {
  list: (params) => http.get(withQuery('/courses', params)), // e.g. { search, dept }
  // get: (id) => http.get(`/courses/${id}`),
  // create: (payload) => http.post('/courses', payload),
  // update: (id, payload) => http.put(`/courses/${id}`, payload),
  // remove: (id) => http.del(`/courses/${id}`),
};
