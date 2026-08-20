import paramiko
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('145.223.18.5', username='root', password='Harsha@tes658')

cmd = """
cd /var/www/vvf-healthcare/backend

echo "=== ENSURING .ENV POSTGRES CONFIG ==="
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

echo "=== RUNNING DB SEEDING ON VPS ==="
npx ts-node src/run_seed.ts || true

echo "=== RESTARTING PM2 PROCESSES ==="
pm2 restart vvf-backend

echo "=== VERIFYING POSTGRES DATABASE COUNTS ==="
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM users;"
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM hospitals;"
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM attendance;"
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM appointments;"
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM field_appointments;"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
ssh.close()
