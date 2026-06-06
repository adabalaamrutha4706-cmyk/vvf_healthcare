import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_vvf_healthcare_jwt_token_key_12345';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    role: 'Admin' | 'Chief Doctor' | 'Doctor' | 'Reception' | 'Telecaller' | 'Executive' | 'Superadmin';
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.', errorCode: 'AUTH_REQUIRED' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if user exists and is active
    const userResult = await query(
      'SELECT id, name, email, role, is_active, is_deleted FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User no longer exists.', errorCode: 'USER_NOT_FOUND' });
    }

    const user = userResult.rows[0];

    if (!user.is_active || user.is_deleted) {
      return res.status(403).json({ success: false, message: 'User account is deactivated or deleted.', errorCode: 'USER_INACTIVE' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.', errorCode: 'INVALID_TOKEN' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.', errorCode: 'AUTH_REQUIRED' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Access denied. Requires one of roles: [${roles.join(', ')}]`, errorCode: 'ACCESS_DENIED' });
    }

    next();
  };
};

export const requireSuperadmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.', errorCode: 'AUTH_REQUIRED' });
  }

  if (req.user.role !== 'Superadmin') {
    return res.status(403).json({ success: false, message: 'Access denied. Superadmin privileges required.', errorCode: 'SUPERADMIN_REQUIRED' });
  }

  next();
};

export const authorize = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.', errorCode: 'AUTH_REQUIRED' });
    }

    if (req.user.role === 'Superadmin') {
      return next();
    }

    const normalizedUserRole = req.user.role.toLowerCase().replace(/\s+/g, '');
    const hasRole = roles.some(role => {
      const normalizedRole = role.toLowerCase().replace(/\s+/g, '');
      return normalizedUserRole === normalizedRole;
    });

    if (!hasRole) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Requires one of roles: [${roles.join(', ')}]. Current: ${req.user.role}`, 
        errorCode: 'ACCESS_DENIED' 
      });
    }

    next();
  };
};


