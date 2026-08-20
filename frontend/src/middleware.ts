import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Lightweight JWT decoder that runs in Next.js Edge Runtime
function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip next.js internal assets, static files, and public images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Identify target auth pages
  const isLoginPage = pathname === '/login' ||
    pathname === '/admin/login' ||
    pathname === '/dental-doctor/login' ||
    pathname === '/dentist-junior/login' ||
    pathname === '/dental-assistant/login' ||
    pathname === '/doctor/login' ||
    pathname === '/executive/login' ||
    pathname === '/reception/login' ||
    pathname === '/telecaller/login' ||
    pathname === '/op-technician/login' ||
    pathname === '/sop-technician/login';

  // Retrieve token cookie
  const tokenCookie = request.cookies.get('token');
  const token = tokenCookie?.value;

  // Get appropriate login redirect path based on current path
  const getRedirectLoginPath = () => {
    return '/login';
  };

  let response: NextResponse | null = null;

  // 3. Root URL Redirect logic
  if (pathname === '/') {
    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.role) {
        const role = decoded.role;
        let target = '/dashboard';
        if (role === 'OP Technician') target = '/op-technician/dashboard';
        else if (role === 'SOP Technician') target = '/sop-technician/dashboard';
        else if (role === 'Dentist Junior') target = '/dentist-junior/dashboard';
        else if (role === 'Dental Assistant') target = '/dental-assistant/dashboard';
        else if (role === 'Superadmin') target = '/superadmin/dashboard';
        response = NextResponse.redirect(new URL(target, request.url));
      }
    } else {
      response = NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 4. Unauthenticated redirects for protected routes
  if (!response && !token) {
    if (!isLoginPage) {
      response = NextResponse.redirect(new URL(getRedirectLoginPath(), request.url));
    }
  }

  // 5. Decode token and enforce role logic if authenticated
  if (!response && token) {
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.role) {
      // Invalid token cookie - clear cookie and redirect to login
      if (!isLoginPage) {
        response = NextResponse.redirect(new URL(getRedirectLoginPath(), request.url));
        response.cookies.delete('token');
      }
    } else {
      const rawRole = decoded.role;
      const rolesList = (rawRole || '').split(',').map((r: string) => {
        const trimmed = r.trim();
        return trimmed === 'Co-admin' ? 'Admin' : trimmed;
      });
      const isSuper = rolesList.includes('Superadmin');

      // Role-based route authorization
      if (pathname.startsWith('/superadmin') && !isLoginPage && !isSuper) {
        response = NextResponse.redirect(new URL('/login', request.url));
      } else if (pathname.startsWith('/admin') && !isLoginPage && !rolesList.includes('Admin') && !isSuper) {
        response = NextResponse.redirect(new URL('/admin/login', request.url));
      } else if (pathname.startsWith('/dental-doctor') && !isLoginPage && !rolesList.includes('Dental Doctor') && !isSuper) {
        response = NextResponse.redirect(new URL('/dental-doctor/login', request.url));
      } else if (pathname.startsWith('/dentist-junior') && !isLoginPage && !rolesList.includes('Dentist Junior') && !isSuper) {
        response = NextResponse.redirect(new URL('/dentist-junior/login', request.url));
      } else if (pathname.startsWith('/dental-assistant') && !isLoginPage && !rolesList.includes('Dental Assistant') && !isSuper) {
        response = NextResponse.redirect(new URL('/dental-assistant/login', request.url));
      } else if (pathname.startsWith('/doctor') && !isLoginPage && !rolesList.includes('Doctor') && !isSuper) {
        response = NextResponse.redirect(new URL('/doctor/login', request.url));
      } else if (pathname.startsWith('/executive') && !isLoginPage && !rolesList.includes('Executive') && !isSuper) {
        response = NextResponse.redirect(new URL('/executive/login', request.url));
      } else if (pathname.startsWith('/reception') && !isLoginPage && !rolesList.includes('Reception') && !isSuper) {
        response = NextResponse.redirect(new URL('/reception/login', request.url));
      } else if (pathname.startsWith('/telecaller') && !isLoginPage && !rolesList.includes('Telecaller') && !isSuper) {
        response = NextResponse.redirect(new URL('/telecaller/login', request.url));
      } else if (pathname.startsWith('/op-technician') && !isLoginPage && !rolesList.includes('OP Technician') && !isSuper) {
        response = NextResponse.redirect(new URL('/op-technician/login', request.url));
      } else if (pathname.startsWith('/sop-technician') && !isLoginPage && !rolesList.includes('SOP Technician') && !isSuper) {
        response = NextResponse.redirect(new URL('/sop-technician/login', request.url));
      }

      // General protected sub-pages checks
      if (!response) {
        const adminOnlyPages = ['/users', '/hospitals', '/reports', '/targets'];
        if (adminOnlyPages.some(page => pathname.startsWith(page)) && !rolesList.includes('Admin') && !isSuper) {
          response = NextResponse.redirect(new URL('/login', request.url));
        } else if (pathname.startsWith('/payments') && !rolesList.includes('Admin') && !rolesList.includes('Reception') && !isSuper) {
          response = NextResponse.redirect(new URL('/login', request.url));
        } else if (pathname.startsWith('/telecaller') && !rolesList.includes('Admin') && !rolesList.includes('Telecaller') && !isSuper) {
          response = NextResponse.redirect(new URL('/login', request.url));
        } else if (pathname.startsWith('/therapies') && !rolesList.includes('Admin') && !rolesList.includes('OP Technician') && !rolesList.includes('SOP Technician') && !isSuper) {
          response = NextResponse.redirect(new URL('/login', request.url));
        } else if (pathname.startsWith('/visits') && !rolesList.includes('Admin') && !rolesList.includes('Executive') && !isSuper) {
          response = NextResponse.redirect(new URL('/login', request.url));
        } else if (pathname.startsWith('/clinical-worklists') && !rolesList.includes('OP Technician') && !rolesList.includes('SOP Technician') && !isSuper) {
          response = NextResponse.redirect(new URL('/login', request.url));
        }
      }

      // Redirect logged in users who try to access login pages
      if (!response && isLoginPage) {
        const targetDashboard = () => {
          if (rolesList.includes('OP Technician')) return '/op-technician/dashboard';
          if (rolesList.includes('SOP Technician')) return '/sop-technician/dashboard';
          if (rolesList.includes('Dentist Junior')) return '/dentist-junior/dashboard';
          if (rolesList.includes('Dental Assistant')) return '/dental-assistant/dashboard';
          if (rolesList.includes('Superadmin')) return '/superadmin/dashboard';
          return '/dashboard';
        };
        response = NextResponse.redirect(new URL(targetDashboard(), request.url));
      }
    }
  }

  // Default fallback if no redirect occurred
  if (!response) {
    response = NextResponse.next();
  }

  // 6. Enforce OWASP ZAP Required Security Headers on ALL response objects
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org; connect-src 'self' https://ipapi.co https://vvf.thehps.in http://localhost:5000 http://localhost:5001 http://127.0.0.1:5000 http://127.0.0.1:5001 ws://localhost:* ws://127.0.0.1:*; font-src 'self' data:; frame-src 'self'; object-src 'none'; base-uri 'self';");

  // 7. Enforce Cache-Control rules on sensitive pages
  const nocachePaths = [
    '/login', '/dashboard', '/settings', '/users', '/admin', '/doctor',
    '/dental-doctor', '/dentist-junior', '/dental-assistant', '/executive', '/reception', '/telecaller',
    '/op-technician', '/sop-technician', '/superadmin', '/visits',
    '/payments', '/hospitals', '/appointments', '/attendance',
    '/therapies', '/reports', '/targets'
  ];
  const isNoCachePath = nocachePaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isNoCachePath) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export const config = {
  // Apply middleware to all matching paths
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
