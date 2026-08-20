import paramiko

VPS_IP = "145.223.18.5"
VPS_USER = "root"
VPS_PASS = "Harsha@tes658"

def clean_print(text):
    print(text.encode('ascii', 'replace').decode('ascii'))

def run_diagnostics():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    node_script = """
const { query } = require('/var/www/vvf-healthcare/backend/dist/config/db');

async function test() {
  const users = (await query("SELECT id, name, email, role, is_active, is_deleted FROM users WHERE role = 'Doctor'")).rows;
  console.log("All doctors in DB:");
  console.log(JSON.stringify(users, null, 2));
}
test();
    """

    ftp = ssh.open_sftp()
    with ftp.file('/tmp/check_doctors.js', 'w') as f:
      f.write(node_script)
    ftp.close()

    stdin, stdout, stderr = ssh.exec_command("node /tmp/check_doctors.js")
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    
    print("--- STDOUT ---")
    clean_print(out)
    print("--- STDERR ---")
    clean_print(err)

    ssh.exec_command("rm /tmp/check_doctors.js")
    ssh.close()

if __name__ == "__main__":
    run_diagnostics()
