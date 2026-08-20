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
const jwt = require('./node_modules/jsonwebtoken');
const { query, checkPostgresConnection } = require('./dist/config/db');

async function test() {
  const isPg = await checkPostgresConnection();
  console.log("PostgreSQL Connected in script:", isPg);

  const docUser = (await query("SELECT id, email, role FROM users WHERE role = 'Doctor' AND is_active = true AND is_deleted = false LIMIT 1")).rows[0];
  if (!docUser) {
    console.log("No active Doctor user found in PG");
    return;
  }
  console.log("Found active doctor:", docUser.email);
  const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_vvf_healthcare_jwt_token_key_12345';
  const token = jwt.sign({ id: docUser.id, email: docUser.email, role: docUser.role }, JWT_SECRET, { expiresIn: '1h' });

  const endpoints = [
    '/api/doctor/appointments',
    '/api/doctor/users/doctors',
    '/api/doctor/users/dentists',
    '/api/doctor/hospitals',
    '/api/doctor/users/telecallers',
    '/api/doctor/therapies',
    '/api/doctor/therapies/technicians'
  ];

  const http = require('http');
  for (const ep of endpoints) {
    await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5001,
        path: ep,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log(`Endpoint ${ep} status: ${res.statusCode}. Body length: ${body.length}`);
          if (res.statusCode !== 200) {
            console.log(`Error body: ${body}`);
          }
          resolve();
        });
      });
      req.on('error', (e) => {
        console.log(`Endpoint ${ep} error: ${e.message}`);
        resolve();
      });
      req.end();
    });
  }
}
test();
    """

    ftp = ssh.open_sftp()
    with ftp.file('/var/www/vvf-healthcare/backend/test_doctor_pg.js', 'w') as f:
      f.write(node_script)
    ftp.close()

    # Run the script inside the backend directory to load .env variables
    stdin, stdout, stderr = ssh.exec_command("cd /var/www/vvf-healthcare/backend && node test_doctor_pg.js")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    
    print("--- STDOUT ---")
    clean_print(out)
    print("--- STDERR ---")
    clean_print(err)

    ssh.exec_command("rm /var/www/vvf-healthcare/backend/test_doctor_pg.js")
    ssh.close()

if __name__ == "__main__":
    run_diagnostics()
