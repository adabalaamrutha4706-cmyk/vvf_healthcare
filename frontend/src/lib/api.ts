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
    localStorage.removeItem('vvf_role');
  }
};

// Helper to retrieve role from localStorage
export const getRole = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('vvf_role');
  }
  return null;
};

// Helper to save role to localStorage
export const setRole = (role: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('vvf_role', role);
  }
};

// Helper to handle API requests
async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const role = getRole();
  
  let formattedEndpoint = endpoint;
  if (!endpoint.startsWith('/auth') && !endpoint.startsWith('/superadmin')) {
    let prefix = '';
    if (role) {
      const r = role.toLowerCase().trim();
      if (r === 'admin') prefix = '/admin';
      else if (r === 'chief doctor') prefix = '/chief-doctor';
      else if (r === 'doctor') prefix = '/doctor';
      else if (r === 'executive') prefix = '/executive';
      else if (r === 'reception') prefix = '/reception';
      else if (r === 'telecaller') prefix = '/telecaller';
      else if (r === 'superadmin') prefix = '/admin';
    }
    formattedEndpoint = `${prefix}${endpoint}`;
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Set Content-Type unless we are uploading files (FormData handles it)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(`${API_BASE_URL}${formattedEndpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
    }

    const resData = await response.json();
    if (resData && typeof resData === 'object' && resData.success === true && resData.data !== undefined) {
      return resData.data;
    }
    return resData;
  } catch (err: any) {
    if (err.message && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch') || err.message.includes('network'))) {
      throw new Error('Network connection error. Please verify the backend server is running and try again.');
    }
    throw err;
  }
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
    getAttendance: (paramsOrId?: number | {
      targetUserId?: number;
      search?: string;
      role?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      lateOnly?: boolean;
      page?: number;
      limit?: number;
    }) => {
      let url = '/auth/attendance';
      if (typeof paramsOrId === 'number') {
        url += `?targetUserId=${paramsOrId}`;
      } else if (paramsOrId && typeof paramsOrId === 'object') {
        const queryParts = Object.entries(paramsOrId)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
        if (queryParts.length > 0) {
          url += `?${queryParts.join('&')}`;
        }
      }
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
    restore: (id: number) => request(`/appointments/${id}/restore`, { method: 'PUT' }),
    addPayment: (id: number, payment: { amount: number; payment_method: string; transaction_ref?: string; notes?: string }) =>
      request(`/appointments/${id}/payments`, { method: 'POST', body: JSON.stringify(payment) }),
    getPayments: (id: number) => request(`/appointments/${id}/payments`),
    getHistory: (id: number) => request(`/appointments/${id}/history`),
    getPendingPayments: (params?: {
      search?: string;
      status?: string;
      doctor_id?: number | string;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      page?: number | string;
      limit?: number | string;
    }) => {
      let url = '/appointments/pending-payments';
      if (params) {
        const queryParts = Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
        if (queryParts.length > 0) {
          url += `?${queryParts.join('&')}`;
        }
      }
      return request(url);
    }
  },

  // Hospitals API
  hospitals: {
    getAll: () => request('/hospitals'),
    getById: (id: number) => request(`/hospitals/${id}`),
    geocodeAddress: (address: string, mapsLink?: string) => 
      request(`/hospitals/geocode-address?address=${encodeURIComponent(address)}&google_maps_link=${encodeURIComponent(mapsLink || '')}`),
    create: (data: any) => request('/hospitals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/hospitals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/hospitals/${id}`, { method: 'DELETE' })
  },

  // Go Visits API (Executives)
  visits: {
    getAll: () => request('/visits'),
    getById: (id: number) => request(`/visits/${id}`),
    start: (formData: FormData) =>
      request('/visits/start', { method: 'POST', body: formData }),
    uploadPhoto: (id: number, formData: FormData) =>
      request(`/visits/${id}/photos`, { method: 'POST', body: formData }),
    end: (id: number, formData: FormData) =>
      request(`/visits/${id}/end`, { method: 'POST', body: formData }),
    complete: (id: number, formData: FormData) =>
      request(`/visits/${id}/complete`, { method: 'POST', body: formData }),
    reopen: (id: number) => request(`/visits/${id}/reopen`, { method: 'POST' }),
    verify: (id: number) => request(`/visits/${id}/verify`, { method: 'PUT' }),
    cancel: (id: number) => request(`/visits/${id}`, { method: 'DELETE' })
  },

  // Telecaller Leads API
  leads: {
    getAll: () => request('/leads'),
    getById: (id: number) => request(`/leads/${id}`),
    create: (data: any) => request('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/leads/${id}`, { method: 'DELETE' })
  },

  // Superadmin API
  superadmin: {
    getStats: () => request('/superadmin/stats'),
    getUsers: () => request('/superadmin/users'),
    getAttendance: () => request('/superadmin/attendance'),
    getAuditLogs: () => request('/superadmin/audit-logs'),
    getAppointments: () => request('/superadmin/appointments'),
    deleteUserPermanent: (id: number) => request(`/superadmin/users/${id}/permanent`, { method: 'DELETE' }),
    deleteAppointmentPermanent: (id: number) => request(`/superadmin/appointments/${id}/permanent`, { method: 'DELETE' })
  },

  // Users API
  users: {
    getAll: () => request('/users'),
    getDoctors: () => request('/users/doctors'),
    getExecutives: () => request('/users/executives'),
    getTelecallers: () => request('/users/telecallers'),
    create: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/users/${id}`, { method: 'DELETE' }),
    restore: (id: number) => request(`/users/${id}/restore`, { method: 'PUT' })
  }
};
