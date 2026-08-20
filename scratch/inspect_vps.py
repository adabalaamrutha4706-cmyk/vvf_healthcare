import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('145.223.18.5', username='root', password='Harsha@tes658')

cmd = """
echo "=== BACKEND .ENV ==="
cat /var/www/vvf-healthcare/backend/.env

echo "=== POSTGRES DB USER COUNT ==="
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM users;"
sudo -u postgres psql -d vvf_healthcare -c "SELECT count(*) FROM hospitals;"

echo "=== PM2 LOGS ==="
pm2 logs vvf-backend --lines 30 --raw
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))
ssh.close()
