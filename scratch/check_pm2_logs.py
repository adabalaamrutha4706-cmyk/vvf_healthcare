import paramiko

VPS_IP = "145.223.18.5"
VPS_USER = "root"
VPS_PASS = "Harsha@tes658"

def clean_print(text):
    print(text.encode('ascii', 'replace').decode('ascii'))

def check_pm2_logs():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    # Check the latest 100 lines of PM2 logs for vvf-backend (process ID 0)
    stdin, stdout, stderr = ssh.exec_command("pm2 logs vvf-backend --lines 100 --nostream")
    logs = stdout.read().decode('utf-8')
    print("--- PM2 LOGS ---")
    clean_print(logs)

    ssh.close()

if __name__ == "__main__":
    check_pm2_logs()
