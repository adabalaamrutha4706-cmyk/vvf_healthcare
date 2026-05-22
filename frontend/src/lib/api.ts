const API_BASE_URL = 'http://localhost:5000/api';

// Helper to retrieve token from localStorage
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('vvf_token');
  }
  return null;
};

// Helper to save token to localStorage
export const setToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('vvf_token', token);
  }
};

// Helper to remove token from localStorage
export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vvf_token');
  }
};

// Helper to handle API requests
async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Set Content-Type unless we are uploading files (FormData handles it)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth API
  auth: {
    login: (credentials: { email: string; password: string }) => 
      request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getMe: () => request('/auth/me'),
    punch: (data: { action: 'in' | 'out'; device_info?: string; gps_latitude?: number; gps_longitude?: number }) =>
      request('/auth/punch', { method: 'POST', body: JSON.stringify(data) }),
    getAttendance: (targetUserId?: number) => {
      const url = targetUserId ? `/auth/attendance?targetUserId=${targetUserId}` : '/auth/attendance';
      return request(url);
    },
    updateProfile: (data: { name?: string; phone?: string; password?: string }) =>
      request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) })
  },

  // Dashboard API
  dashboard: {
    getStats: () => request('/dashboard/stats'),
    getCharts: () => request('/dashboard/charts'),
    getNotifications: () => request('/dashboard/notifications'),
    markNotificationRead: (id: number) => 
      request(`/dashboard/notifications/${id}/read`, { method: 'PUT' })
  },

  // Appointments API
  appointments: {
    getAll: () => request('/appointments'),
    getById: (id: number) => request(`/appointments/${id}`),
    create: (data: any) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/appointments/${id}`, { method: 'DELETE' }),
    addPayment: (id: number, payment: { amount: number; payment_method: string; transaction_ref?: string; notes?: string }) =>
      request(`/appointments/${id}/payments`, { method: 'POST', body: JSON.stringify(payment) }),
    getPayments: (id: number) => request(`/appointments/${id}/payments`)
  },

  // Hospitals API
  hospitals: {
    getAll: () => request('/hospitals'),
    getById: (id: number) => request(`/hospitals/${id}`),
    create: (data: any) => request('/hospitals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/hospitals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/hospitals/${id}`, { method: 'DELETE' })
  },

  // Go Visits API (Executives)
  visits: {
    getAll: () => request('/visits'),
    getById: (id: number) => request(`/visits/${id}`),
    start: (data: { hospital_id: number; gps_lat?: number; gps_lng?: number; city?: string; state?: string }) =>
      request('/visits/start', { method: 'POST', body: JSON.stringify(data) }),
    uploadPhoto: (id: number, formData: FormData) =>
      request(`/visits/${id}/photos`, { method: 'POST', body: formData }), // FormData must not have Content-Type header set manually
    end: (id: number, data: { summary: string; notes?: string }) =>
      request(`/visits/${id}/end`, { method: 'POST', body: JSON.stringify(data) }),
    verify: (id: number) => request(`/visits/${id}/verify`, { method: 'PUT' })
  },

  // Telecaller Leads API
  leads: {
    getAll: () => request('/leads'),
    getById: (id: number) => request(`/leads/${id}`),
    create: (data: any) => request('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/leads/${id}`, { method: 'DELETE' })
  },

  // Users API
  users: {
    getAll: () => request('/users'),
    getDoctors: () => request('/users/doctors'),
    create: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/users/${id}`, { method: 'DELETE' })
  }
};
