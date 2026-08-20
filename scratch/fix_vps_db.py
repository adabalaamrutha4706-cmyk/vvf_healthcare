import paramiko
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('145.223.18.5', username='root', password='Harsha@tes658')

cmd = """
echo "=== RESETTING POSTGRES PASSWORD FOR USER postgres ==="
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'lms_password';"

echo "=== CHECKING DATA IN VVF_HEALTHCARE DATABASE ==="
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM users;"
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM hospitals;"
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM appointments;"

echo "=== TESTING POSTGRES CONNECTION WITH LMSPASSWORD ==="
PGPASSWORD=lms_password psql -U postgres -h localhost -d vvf_healthcare -c "SELECT 'Connection successful' as status;"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
ssh.close()
