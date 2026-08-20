#!/bin/bash

# ==============================================================================
# VVF Healthcare VPS Deployment Script
# ==============================================================================
# INSTRUCTIONS:
# 1. Update the VPS_IP, VPS_USER, and APP_DIR variables below.
# 2. Make the script executable: chmod +x deploy.sh
# 3. Run the script: ./deploy.sh
# ==============================================================================

# --- Configuration ---
VPS_IP="145.223.18.5"          # <-- Change this to your VPS IP or Domain
VPS_USER="root"             # <-- Change this to your VPS SSH user (e.g., ubuntu, root)
APP_DIR="/var/www/vvf-healthcare"
SSH_KEY_PATH=""               # <-- Optional: Path to your SSH private key (e.g., ~/.ssh/id_rsa)

# Determine SSH identity option
SSH_OPTS=""
if [ -n "$SSH_KEY_PATH" ]; then
    SSH_OPTS="-i $SSH_KEY_PATH"
fi

echo "🚀 Starting deployment to $VPS_USER@$VPS_IP..."

# 1. Sync files to the VPS using rsync
echo "📦 Syncing files to VPS..."
rsync -avz -e "ssh $SSH_OPTS" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='uploads' \
  ./ "$VPS_USER@$VPS_IP:$APP_DIR/"

# 2. Run remote deployment commands on the VPS
echo "💻 Executing remote build and restart commands..."
ssh $SSH_OPTS "$VPS_USER@$VPS_IP" << 'EOF'
    set -e
    APP_DIR="/var/www/vvf-healthcare"
    cd "$APP_DIR"

    echo "⚙️ Installing Node.js dependencies..."
    
    # Backend setup
    echo "  -> Setting up Backend..."
    cd backend
    npm install
    npm run build
    
    # Create backend .env if it doesn't exist
    if [ ! -f .env ]; then
        echo "⚠️ backend/.env file not found. Creating a template..."
        cat << 'ENV' > .env
PORT=5001
DATABASE_URL=postgresql://postgres:lms_password@localhost:5432/vvf_healthcare
JWT_SECRET=super_secret_vvf_healthcare_jwt_token_key_12345
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp
USE_LOCAL_DB=false
MIN_VISIT_DURATION_MINS=10
ENV
        echo "👉 Please update backend/.env with your production database credentials on the VPS."
    fi
    cd ..

    # Frontend setup
    echo "  -> Setting up Frontend..."
    cd frontend
    npm install
    
    # Create frontend .env if it doesn't exist
    if [ ! -f .env.local ]; then
        echo "NEXT_PUBLIC_BACKEND_URL=https://vvf.thehps.in" > .env.local
    fi
    
    npm run build
    cd ..

    # 3. Process Management with PM2
    echo "🔄 Restarting applications with PM2..."
    
    # Restart or start Backend (port 5001)
    cd backend
    pm2 describe vvf-backend > /dev/null 2>&1 && pm2 restart vvf-backend || pm2 start dist/server.js --name vvf-backend --env production
    cd ..

    # Restart or start Frontend (port 3005)
    cd frontend
    # Next.js starts on port 3005 as configured in Nginx
    pm2 describe vvf-frontend > /dev/null 2>&1 && pm2 restart vvf-frontend || pm2 start npm --name vvf-frontend -- run start -- -p 3005
    cd ..

    pm2 save

    # 4. Configure Nginx and SSL
    echo "🛡️ Configuring Nginx reverse proxy..."
    sudo cp nginx/vvf.thehps.in.conf /etc/nginx/sites-available/vvf.thehps.in.conf
    sudo ln -sf /etc/nginx/sites-available/vvf.thehps.in.conf /etc/nginx/sites-enabled/
    
    echo "Testing Nginx configuration..."
    sudo nginx -t

    echo "Reloading Nginx..."
    sudo systemctl reload nginx

    # Check if SSL certificates exist, if not run Certbot
    if [ ! -d "/etc/letsencrypt/live/vvf.thehps.in" ]; then
        echo "🔒 SSL certificate not found. Running Certbot..."
        sudo certbot --nginx -d vvf.thehps.in --non-interactive --agree-tos -m admin@thehps.in
    else
        echo "✅ SSL certificate already exists."
    fi

    echo "🎉 Remote deployment steps completed successfully!"
EOF

echo "✨ Deployment complete! Please verify your application at https://vvf.thehps.in"
