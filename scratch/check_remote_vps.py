import paramiko

VPS_IP = "145.223.18.5"
VPS_USER = "root"
VPS_PASS = "Harsha@tes658"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)

cmd = """
echo "=== Checking source file on VPS ==="
ls -la /var/www/vvf-healthcare/frontend/src/app/admin/oxygen-cylinders/ || echo "NOT FOUND"

echo "=== Checking Next.js build output on VPS ==="
ls -la /var/www/vvf-healthcare/frontend/.next/server/app/admin/oxygen-cylinders/ || echo "BUILD OUTPUT NOT FOUND"

echo "=== Curlling local Next.js server on VPS ==="
curl -i http://127.0.0.1:3005/admin/oxygen-cylinders || echo "CURL FAILED"

echo "=== Curlling direct oxygen-cylinders route ==="
curl -i http://127.0.0.1:3005/oxygen-cylinders || echo "CURL DIRECT FAILED"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

ssh.close()
