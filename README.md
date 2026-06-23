# Venkateswara Vascular Foundation (VVF) Healthcare Management System

A robust, enterprise-grade, multi-tenant healthcare administration and field operations platform designed for the Venkateswara Vascular Foundation. It features role-based workflows, automated telecalling queues, field executive GPS-verified visits, clinical therapy tracking, and comprehensive billing operations.

---

## 🚀 Key Features

### 1. Multi-Role Enterprise Portal
Integrated dashboard workspaces with customized interfaces for 9 different operational roles:
*   **Superadmin**: System-wide platform governance, permanent record deletions, database audit logs, user provisioning, and authorization controls.
*   **Admin**: Hospital onboarding, team management, target setting, billing reports, and daily operations management.
*   **Doctor & Dental Doctor**: Appointment consultation queues, patient medical history management, treatment logging, and dental concern tracking.
*   **Reception**: Quick patient check-ins, registration, appointment booking, payments collection (Cash & UPI), and receipt generation.
*   **Telecaller**: Leads outreach workspace, follow-up scheduler, call notes, and integration with automated lead assignment.
*   **Executive (Field Representative)**: Real-time on-field hospital visits, geofenced verification, and lead generation check-ins.
*   **OP Technician & SOP Technician**: Operation logs and double-signature verification workflow for clinical therapies (HBOT, Ozone, Lab, etc.).

### 2. GPS-Verified Field Visit & Geofencing System
*   **Geofenced Check-In**: Ensures field representatives are physically present within a configured radius (e.g., 200m) of target hospitals before allowing check-in.
*   **Live Photo Capture**: Live camera check-ins with tamper-proof watermarks depicting date, time, and coordinates.
*   **Offline Capability**: Offline buffer queue allowing executives to check in and record visits in low-network regions, auto-syncing when connection restores.
*   **Auto-Expiration & Reminders**: Automatically marks stale visits as expired and sends push notifications for check-outs.

### 3. Outbound Telecalling & Auto-Redistribution
*   **Executive-to-Telecaller Pipeline**: Leads captured by field executives are routed instantly to active telecallers.
*   **Auto-Rebalancing**: Background cron job to distribute pending leads equally among online telecallers to avoid burnout and optimize conversion rates.

### 4. Specialized Therapy Loggers
*   Dedicated session trackers for hyperbaric and regenerative treatments including:
    *   **HBOT (Hyperbaric Oxygen Therapy)** & **Ozone Therapy**: Logs dive/surface times, chamber pressure value, and next session details.
    *   **Pelvic Chair**, **SIPCD**, **Zero Gravity**, **Physiotherapy**, & **Dental**.
    *   **Hydrogen Inhalation** & **Lab**: Logs test orders, print outputs, and WhatsApp dispatch logs.
*   Requires a two-tier verification (OP Technician logs it, SOP Technician approves it).

### 5. Shift & Attendance Tracker
*   Punch-in/Punch-out session recording for all office staff.
*   Captures device information, punch time, and GPS location at the moment of shift initiation/termination.

---

## 🛠️ Technology Stack

### Frontend
*   **Framework**: Next.js (v16.x) with TypeScript
*   **State Management**: React Context (Auth, UI states)
*   **Styling**: PostCSS & Tailwind CSS
*   **Animations**: Framer Motion
*   **Icons**: Lucide React
*   **Utilities**: Excel XLSX Export, jsPDF / AutoTable for reports generation

### Backend
*   **Runtime**: Node.js (v20.x) with Express & TypeScript
*   **Database**: PostgreSQL (v17.x)
*   **Auth**: JWT (JSON Web Tokens) & BcryptJS password hashing
*   **File Uploads**: Multer static disk storage

---

## 📂 Project Structure

```
vvf-healthcare/
├── backend/
│   ├── src/
│   │   ├── config/       # PostgreSQL connection & auto-migration seeds
│   │   ├── controllers/  # Business logic controllers
│   │   ├── middleware/   # JWT Authentication & role RBAC filters
│   │   ├── routes/       # Express route handlers
│   │   └── server.ts     # Server entry point
│   ├── schema.sql        # Database initialization schema
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js pages router routes
│   │   ├── components/   # Reusable UI component blocks
│   │   ├── context/      # Auth & punch context states
│   │   └── lib/          # Custom fetch client and API client
│   ├── package.json
│   └── tailwind.config.ts
└── README.md             # Project roadmap & documentation
```

---

## ⚙️ Deployment Configurations

### 1. Nginx Reverse Proxy Config
Nginx manages SSL termination and proxies requests to backend PM2 processes:
```nginx
server {
    server_name vvf.thehps.in;
    client_max_body_size 50M;

    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5001/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3005/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

### 2. SSL
HTTPS is secured via Let's Encrypt using Certbot:
```bash
sudo certbot --nginx -d vvf.thehps.in
```

### 3. PM2 Process Managers
Both frontend and backend are kept alive globally using PM2:
*   **Backend Port**: `5001`
*   **Frontend Port**: `3005`
*   **Startup**: Persisted using systemd service daemon (`pm2 startup` & `pm2 save`).
