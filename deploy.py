

import os
import zipfile
import paramiko
from scp import SCPClient
import sys

# Reconfigure stdout to support UTF-8 on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# --- Configuration ---
VPS_IP = "145.223.18.5"
VPS_USER = "root"
VPS_PASS = "Harsha@tes658"
APP_DIR = "/var/www/vvf-healthcare"
ZIP_NAME = "vvf-healthcare.zip"

EXCLUDE_DIRS = {
    '.git', 'node_modules', '.next', 'dist', 'uploads', '__pycache__', '.idea', '.vscode'
}
EXCLUDE_FILES = {
    ZIP_NAME, 'deploy.py', '.env', 'deploy.sh'
}

def zip_project():
    print("[ZIP] Zipping project files...")
    with zipfile.ZipFile(ZIP_NAME, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Modify dirs in-place to exclude unwanted directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            
            for file in files:
                if file in EXCLUDE_FILES or file.startswith('.'):
                    continue
                file_path = os.path.join(root, file)
                archive_name = os.path.relpath(file_path, '.')
                zipf.write(file_path, archive_name)
    print(f"[ZIP] Created {ZIP_NAME}")

def deploy():
    zip_project()
    
    # Initialize SSH client
    print("[SSH] Connecting to VPS...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)
        ssh.get_transport().set_keepalive(15)
        print("[SSH] Connected successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to connect: {e}")
        sys.exit(1)
        
    # 1. Copy the zip file to the VPS
    print(f"[UPLOAD] Uploading {ZIP_NAME} to VPS...")
    try:
        with SCPClient(ssh.get_transport()) as scp:
            # Upload to /tmp or /var/tmp which is globally writable
            scp.put(ZIP_NAME, '/var/tmp/' + ZIP_NAME)
        print("[UPLOAD] Upload complete.")
    except Exception as e:
        print(f"[ERROR] Upload failed: {e}")
        ssh.close()
        sys.exit(1)
        
    # 2. Run remote deployment commands
    print("[SSH] Running remote deployment commands...")
    remote_commands = f"""
    set -e
    mkdir -p {APP_DIR}
    unzip -o /var/tmp/{ZIP_NAME} -d {APP_DIR}
    rm -f /var/tmp/{ZIP_NAME}
    
    cd {APP_DIR}
    
    # Backend setup
    echo "Setting up Backend..."
    cd backend
    npm install
    npm run build
    if [ ! -f .env ]; then
        cat << 'ENV' > .env
PORT=5001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vvf_healthcare
JWT_SECRET=super_secret_vvf_healthcare_jwt_token_key_12345
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp
USE_LOCAL_DB=false
MIN_VISIT_DURATION_MINS=10
ENV
    fi
    cd ..
    
    # Frontend setup
    echo "Setting up Frontend..."
    cd frontend
    npm install
    if [ ! -f .env.local ]; then
        echo "NEXT_PUBLIC_BACKEND_URL=https://vvf.thehps.in" > .env.local
    fi
    npm run build
    cd ..
    
    # PM2 deployment
    echo "Restarting processes with PM2..."
    cd backend
    pm2 describe vvf-backend > /dev/null 2>&1 && pm2 restart vvf-backend || pm2 start dist/server.js --name vvf-backend
    cd ..
    
    cd frontend
    pm2 describe vvf-frontend > /dev/null 2>&1 && pm2 restart vvf-frontend || pm2 start npm --name vvf-frontend -- run start -- -p 3005
    cd ..
    pm2 save
    
    # Nginx configuration
    echo "Configuring Nginx..."
    cp nginx/vvf.thehps.in.conf /etc/nginx/sites-available/vvf.thehps.in.conf
    ln -sf /etc/nginx/sites-available/vvf.thehps.in.conf /etc/nginx/sites-enabled/
    nginx -t
    systemctl reload nginx
    
    # SSL setup
    if [ ! -d "/etc/letsencrypt/live/vvf.thehps.in" ]; then
        echo "Running Certbot..."
        certbot --nginx -d vvf.thehps.in --non-interactive --agree-tos -m admin@thehps.in
    fi
    """
    
    stdin, stdout, stderr = ssh.exec_command(remote_commands, get_pty=True)
    
    # Print output in real-time
    for line in iter(stdout.readline, ""):
        print(line, end="")
        
    exit_status = stdout.channel.recv_exit_status()
    if exit_status != 0:
        print(f"[ERROR] Remote execution failed with exit code {exit_status}")
        # Print stderr
        for line in stderr.readlines():
            print(line, end="")
        ssh.close()
        sys.exit(1)
        
    ssh.close()
    
    # Clean up local zip
    if os.path.exists(ZIP_NAME):
        os.remove(ZIP_NAME)
        
    print("[SUCCESS] Deployment completed successfully!")

if __name__ == "__main__":
    deploy()
