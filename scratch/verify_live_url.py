import paramiko

VPS_IP = "145.223.18.5"
VPS_USER = "root"
VPS_PASS = "Harsha@tes658"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)

cmd = """
echo "=== Curlling http://127.0.0.1:3005/admin/oxygen-cylinders ==="
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3005/admin/oxygen-cylinders

echo "=== Curlling https://vvf.thehps.in/admin/oxygen-cylinders ==="
curl -s -k -o /dev/null -w "%{http_code}\n" https://vvf.thehps.in/admin/oxygen-cylinders
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
