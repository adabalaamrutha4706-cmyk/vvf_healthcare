import paramiko

VPS_IP = "145.223.18.5"
VPS_USER = "root"
VPS_PASS = "Harsha@tes658"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS)

cmd = """
PGPASSWORD=lms_password psql -h 127.0.0.1 -U postgres -d vvf_healthcare -c "
CREATE TABLE IF NOT EXISTS oxygen_cylinders (
    id SERIAL PRIMARY KEY,
    container_type VARCHAR(50) NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    entry_datetime TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    bill_dc_no VARCHAR(100),
    psi_pressure VARCHAR(100),
    photo_url TEXT,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_oxygen_cylinders_type ON oxygen_cylinders(container_type);
CREATE INDEX IF NOT EXISTS idx_oxygen_cylinders_movement ON oxygen_cylinders(movement_type);
CREATE INDEX IF NOT EXISTS idx_oxygen_cylinders_hospital ON oxygen_cylinders(hospital_id);
"

echo "=== Verifying table creation ==="
PGPASSWORD=lms_password psql -h 127.0.0.1 -U postgres -d vvf_healthcare -c "SELECT table_name FROM information_schema.tables WHERE table_name = 'oxygen_cylinders';"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

ssh.close()
