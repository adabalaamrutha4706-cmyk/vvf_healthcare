import paramiko

VPS_IP = "145.223.18.5"
VPS_USER = "root"
VPS_PASS = "Harsha@tes658"

def clean_print(text):
    print(text.encode('ascii', 'replace').decode('ascii'))

def check_db():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    # Check .env file and check if Postgres is running/connected
    stdin, stdout, stderr = ssh.exec_command("cat /var/www/vvf-healthcare/backend/.env")
    env_content = stdout.read().decode('utf-8')
    print("--- BACKEND .env ---")
    clean_print(env_content)

    # Let's run a node script that logs the db status
    node_script = """
const { isUsingLocalDb, checkPostgresConnection } = require('/var/www/vvf-healthcare/backend/dist/config/db');
async function test() {
  const isPgConnected = await checkPostgresConnection();
  console.log("PostgreSQL Connection Check:", isPgConnected);
  console.log("Is using local JSON db fallback:", isUsingLocalDb());
}
test();
    """
    ftp = ssh.open_sftp()
    with ftp.file('/tmp/check_db_status.js', 'w') as f:
      f.write(node_script)
    ftp.close()

    stdin, stdout, stderr = ssh.exec_command("node /tmp/check_db_status.js")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("--- STDOUT ---")
    clean_print(out)
    print("--- STDERR ---")
    clean_print(err)

    ssh.exec_command("rm /tmp/check_db_status.js")
    ssh.close()

if __name__ == "__main__":
    check_db()
