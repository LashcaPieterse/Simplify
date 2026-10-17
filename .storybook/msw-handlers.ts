import { http, HttpResponse } from 'msw';

export const mswHandlers = [
  http.get('/api/auth/session', () => HttpResponse.json({})),
];
