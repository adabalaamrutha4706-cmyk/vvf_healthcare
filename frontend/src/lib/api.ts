export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const API_BASE_URL = `${BACKEND_URL}/api`;

// Helper to retrieve token from localStorage
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('vvf_token');
  }
  return null;
};

// Helper to save token to localStorage and cookies
export const setToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('vvf_token', token);
    // Write standard browser cookie for Next.js Middleware access
    const isSecure = window.location.protocol === 'https:';
    document.cookie = `token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  }
};

// Helper to remove token from localStorage and cookies
export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vvf_token');
    localStorage.removeItem('vvf_role');
    // Clear standard browser cookie
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
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
  if (!endpoint.startsWith('/auth') && !endpoint.startsWith('/superadmin') && !endpoint.startsWith('/oxygen-cylinders')) {
    let prefix = '';
    if (role) {
      const r = role.toLowerCase().trim();
      if (r === 'admin' || r === 'co-admin') prefix = '/admin';
      else if (r === 'dental doctor') prefix = '/dental-doctor';
      else if (r === 'dentist junior') prefix = '/dentist-junior';
      else if (r === 'dental assistant') prefix = '/dental-assistant';
      else if (r === 'doctor') prefix = '/doctor';
      else if (r === 'executive') prefix = '/executive';
      else if (r === 'reception') prefix = '/reception';
      else if (r === 'telecaller') prefix = '/telecaller';
      else if (r === 'superadmin') prefix = '/admin';
      else if (r === 'op technician') prefix = '/op-technician';
      else if (r === 'sop technician') prefix = '/sop-technician';
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
      cache: 'no-store'
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
    login: (credentials: { email: string; password: string; latitude?: number; longitude?: number }) => 
      request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    autoLogout: () => request('/auth/auto-logout', { method: 'POST' }),
    getMe: () => request('/auth/me'),
    requestPasswordReset: (email: string) =>
      request('/auth/forgot-password-request', { method: 'POST', body: JSON.stringify({ email }) }),
    punch: (data: { action: 'in' | 'out'; device_info?: string; gps_latitude?: number; gps_longitude?: number }) =>
      request('/auth/punch', { method: 'POST', body: JSON.stringify(data) }),
    getAttendance: (paramsOrId?: number | {
      targetUserId?: number;
      search?: string;
      role?: string;
      status?: string;
      hospital_id?: string;
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
    updateProfile: (data: {
      name?: string;
      phone?: string;
      password?: string;
      personal_email?: string;
      age?: number | string;
      date_of_birth?: string;
      gender?: string;
      about?: string;
    }) =>
      request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    uploadProfilePhoto: (formData: FormData) =>
      request('/auth/profile/photo', { method: 'POST', body: formData }),
    updateAttendanceLocation: (data: { gps_latitude: number; gps_longitude: number }) =>
      request('/auth/attendance-location', { method: 'POST', body: JSON.stringify(data) })
  },

  // Dashboard API
  dashboard: {
    getStats: () => request('/dashboard/stats'),
    getCharts: () => request('/dashboard/charts'),
    getNotifications: () => request('/dashboard/notifications'),
    markNotificationRead: (id: number) => 
      request(`/dashboard/notifications/${id}/read`, { method: 'PUT' }),
    markAllNotificationsRead: () =>
      request('/dashboard/notifications/read-all', { method: 'PUT' })
  },

  // Appointments API
  appointments: {
    getAll: (params?: { start_date?: string; end_date?: string; page?: number | string; limit?: number | string }) => {
      let url = '/appointments';
      if (params) {
        const queryParts = Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
        if (queryParts.length > 0) {
          url += `?${queryParts.join('&')}`;
        }
      }
      return request(url);
    },
    getPaymentsReport: (params?: { 
      start_date?: string; 
      end_date?: string; 
      hospital_id?: string;
      search?: string;
      status?: string;
      doctor_id?: string | number;
    }) => {
      let url = '/appointments/payments-report';
      if (params) {
        const queryParts = Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
        if (queryParts.length > 0) {
          url += `?${queryParts.join('&')}`;
        }
      }
      return request(url);
    },
    getById: (id: number) => request(`/appointments/${id}`),
    create: (data: any) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/appointments/${id}`, { method: 'DELETE' }),
    restore: (id: number) => request(`/appointments/${id}/restore`, { method: 'PUT' }),
    lookupPatient: (params: { name?: string; phone?: string; patient_id?: string }) => {
      let url = '/appointments/patients/lookup';
      const parts: string[] = [];
      if (params.name) parts.push(`name=${encodeURIComponent(params.name)}`);
      if (params.phone) parts.push(`phone=${encodeURIComponent(params.phone)}`);
      if (params.patient_id) parts.push(`patient_id=${encodeURIComponent(params.patient_id)}`);
      if (parts.length > 0) {
        url += '?' + parts.join('&');
      }
      return request(url);
    },
    moveToTelecalling: (id: number, data: {
      phone_number: string;
      outreach_status: string;
      callback_date?: string;
      telecaller_id: number;
      outbound_notes?: string;
    }) => request(`/appointments/${id}/move-to-telecalling`, { method: 'PUT', body: JSON.stringify(data) }),
    addPayment: (id: number, payment: { amount: number; payment_method: string; transaction_ref?: string; notes?: string; payment_splits?: any; upi_app?: string; payer_upi_id?: string }) =>
      request(`/appointments/${id}/payments`, { method: 'POST', body: JSON.stringify(payment) }),
    updatePayment: (id: number, paymentId: number, payment: { transaction_ref: string; upi_app?: string; payer_upi_id?: string; payment_splits?: any }) =>
      request(`/appointments/${id}/payments/${paymentId}`, { method: 'PUT', body: JSON.stringify(payment) }),
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
    getAll: (params?: { type?: string }) => {
      let url = '/visits';
      if (params?.type) url += `?type=${params.type}`;
      return request(url);
    },
    getById: (id: number) => request(`/visits/${id}`),
    start: (formData: FormData) =>
      request('/visits/start', { method: 'POST', body: formData }),
    uploadPhoto: (id: number, formData: FormData) =>
      request(`/visits/${id}/photos`, { method: 'POST', body: formData }),
    end: (id: number, formData: FormData) =>
      request(`/visits/${id}/end`, { method: 'POST', body: formData }),
    complete: (id: number, formData: FormData) =>
      request(`/visits/${id}/complete`, { method: 'POST', body: formData }),
    updateNotes: (id: number, data: { notes: string; summary?: string }) =>
      request(`/visits/${id}/notes`, { method: 'PUT', body: JSON.stringify(data) }),
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

  // Oxygen Cylinders API
  oxygen: {
    getAll: (params?: { container_type?: string; movement_type?: string; search?: string; start_date?: string; end_date?: string }) => {
      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, val]) => {
          if (val) queryParams.append(key, val);
        });
      }
      const qs = queryParams.toString();
      return request(`/oxygen-cylinders${qs ? `?${qs}` : ''}`);
    },
    getSummary: () => request('/oxygen-cylinders/summary'),
    create: (body: FormData | any) =>
      request('/oxygen-cylinders', {
        method: 'POST',
        body: body instanceof FormData ? body : JSON.stringify(body)
      }),
    update: (id: number, body: FormData | any) =>
      request(`/oxygen-cylinders/${id}`, {
        method: 'PUT',
        body: body instanceof FormData ? body : JSON.stringify(body)
      }),
    delete: (id: number) => request(`/oxygen-cylinders/${id}`, { method: 'DELETE' })
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
    getDentists: () => request('/users/dentists'),
    getExecutives: () => request('/users/executives'),
    getTelecallers: () => request('/users/telecallers'),
    getTechnicians: () => request('/users/technicians'),
    create: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/users/${id}`, { method: 'DELETE' }),
    restore: (id: number) => request(`/users/${id}/restore`, { method: 'PUT' })
  },
  
  // Therapies API
  therapies: {
    getAll: (params?: {
      hospital_id?: string;
      status?: string;
      therapy_type?: string;
      search?: string;
      start_date?: string;
      end_date?: string;
      op_technician_id?: string;
      sop_technician_id?: string;
    }) => {
      let url = '/therapies';
      if (params) {
        const queryParts = Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
        if (queryParts.length > 0) {
          url += `?${queryParts.join('&')}`;
        }
      }
      return request(url);
    },
    getById: (id: number) => request(`/therapies/${id}`),
    getTechnicians: () => request('/therapies/technicians'),
    create: (data: any) => request('/therapies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/therapies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    verify: (id: number, data: { verified: boolean; remarks?: string }) => 
      request(`/therapies/${id}/verify`, { method: 'PUT', body: JSON.stringify(data) })
  },
  
  // Reports API
  reports: {
    getDaily: (params?: {
      startDate?: string;
      endDate?: string;
      role?: string;
      userId?: string;
      page?: number;
      limit?: number;
    }) => {
      let url = '/reports/daily';
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

  // Field Appointments API
  fieldAppointments: {
    getAll: (params?: {
      search?: string;
      appointment_type?: string;
      executive_id?: string | number;
      start_date?: string;
      end_date?: string;
      status?: string;
    }) => {
      let url = '/field-appointments';
      if (params) {
        const queryParts = Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
        if (queryParts.length > 0) {
          url += `?${queryParts.join('&')}`;
        }
      }
      return request(url);
    },
    create: (data: any) => request('/field-appointments', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id: number, data: { status: string }) =>
      request(`/field-appointments/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
    telecallerAction: (id: number, data: { status?: string; notes?: string; next_followup_date?: string }) =>
      request(`/field-appointments/${id}/telecaller-action`, { method: 'PUT', body: JSON.stringify(data) }),
    reassign: (data: { leadIds: number[]; telecallerId: number }) =>
      request('/field-appointments/reassign', { method: 'PUT', body: JSON.stringify(data) }),
    rebalance: () =>
      request('/field-appointments/rebalance', { method: 'POST' }),
    getPerformance: () =>
      request('/field-appointments/telecaller-performance'),
    getRedistributionLogs: () =>
      request('/field-appointments/redistribution-logs')
  }
};

