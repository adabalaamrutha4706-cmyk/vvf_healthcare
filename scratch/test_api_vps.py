import paramiko

VPS_IP = "145.223.18.5"
VPS_USER = "root"
VPS_PASS = "Harsha@tes658"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)

cmd = """
echo "=== Curlling /api/oxygen-cylinders/summary ==="
curl -i http://127.0.0.1:5001/api/oxygen-cylinders/summary
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
