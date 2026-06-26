import { Pool, QueryResultRow } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load env
import dotenv from 'dotenv';
dotenv.config();

const useLocalDb = process.env.USE_LOCAL_DB === 'true';
const dbUrl = process.env.DATABASE_URL;

let pool: Pool | null = null;
if (!useLocalDb && dbUrl) {
  const isLocalHost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('::1');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalHost ? undefined : { rejectUnauthorized: false }
  });
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client:', err.message || err);
  });
}
const localDbPath = path.join(__dirname, '../../data/local_db.json');

// Ensure data folder exists
const dataDir = path.dirname(localDbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initial default seed structure for Local DB
const initialData: Record<string, any[]> = {
  users: [],
  attendance: [],
  hospitals: [],
  appointments: [],
  payments: [],
  leads: [],
  visits: [],
  visit_photos: [],
  notifications: [],
  audit_logs: [],
  appointment_edit_history: [],
  field_appointments: [],
  auto_redistribution_log: [],
  therapy_sessions: [],
  therapy_hbot: [],
  therapy_ozone: [],
  therapy_physiotherapy: [],
  therapy_dental: [],
  therapy_pelvic_chair: [],
  therapy_sipcd: [],
  therapy_zero_gravity: [],
  therapy_hydrogen_inhalation: [],
  therapy_lab: []
};


// Initialize file db if not present
if (!fs.existsSync(localDbPath)) {
  fs.writeFileSync(localDbPath, JSON.stringify(initialData, null, 2), 'utf8');
}

// Simple in-memory storage synced to file for the fallback database
class LocalDatabase {
  private data: Record<string, any[]> = {};

  constructor() {
    this.read();
  }

  private read() {
    try {
      if (fs.existsSync(localDbPath)) {
        const fileContent = fs.readFileSync(localDbPath, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        this.data = { ...initialData };
        this.write();
      }
    } catch (e) {
      console.error('Error reading local DB, resetting to empty schema:', e);
      this.data = { ...initialData };
    }
  }

  private write() {
    try {
      fs.writeFileSync(localDbPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error writing local DB:', e);
    }
  }

  public query(sql: string, params: any[] = []): { rows: any[] } {
    this.read(); // Refresh from file
    sql = sql.trim().replace(/\s+/g, ' ');

    const lowerSql = sql.toLowerCase();
    
    // 1. INSERT INTO
    if (lowerSql.startsWith('insert into')) {
      const match = sql.match(/insert into (\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      if (match) {
        const table = match[1].toLowerCase();
        const columns = match[2].split(',').map(c => c.trim());
        const valuesPlaceholder = match[3].split(',').map(v => v.trim());

        if (!this.data[table]) {
          this.data[table] = [];
        }

                const newRow: Record<string, any> = {};
        
        // Find next ID
        const maxId = this.data[table].reduce((max, r) => (r.id > max ? r.id : max), 0);
        newRow.id = maxId + 1;

        columns.forEach((col, index) => {
          const valPlaceholder = valuesPlaceholder[index];
          let val: any;
          if (valPlaceholder.startsWith('$')) {
            const paramIdx = parseInt(valPlaceholder.substring(1), 10) - 1;
            val = params[paramIdx];
          } else {
            // Literal value
            val = valPlaceholder.replace(/['"]/g, '');
            if (val === 'true') val = true;
            if (val === 'false') val = false;
            if (val === 'null') val = null;
          }
          newRow[col] = val;
        });

        // Check if row with the same ID already exists
        const idToCheck = newRow.id;
        const existingRowIndex = this.data[table].findIndex(r => String(r.id) === String(idToCheck));

        if (existingRowIndex >= 0) {
          const existingRow = this.data[table][existingRowIndex];
          Object.assign(existingRow, newRow);
          existingRow.updated_at = new Date().toISOString();
          this.write();
          return { rows: [existingRow] };
        } else {
          // Set default timestamps if not provided
          if (!newRow.created_at) newRow.created_at = new Date().toISOString();
          if (newRow.is_deleted === undefined) newRow.is_deleted = false;

          this.data[table].push(newRow);
          this.write();
          return { rows: [newRow] };
        }
      }
    }

    // 2. UPDATE
    if (lowerSql.startsWith('update')) {
      const match = sql.match(/update (\w+)\s+set\s+(.*?)(?:\s+where\s+(.*))?$/i);
      if (match) {
        const table = match[1].toLowerCase();
        const setClause = match[2];
        const whereClause = match[3] || '';

        const rows = this.data[table] || [];
        
        // Parse setter
        const setPairs = setClause.split(',').map(pair => {
          const parts = pair.split('=');
          return {
            col: parts[0].trim(),
            valPlaceholder: parts[1].trim()
          };
        });

        const matchingRows = this.filterRows(rows, whereClause, params);
        
        matchingRows.forEach(row => {
          setPairs.forEach(({ col, valPlaceholder }) => {
            if (valPlaceholder.startsWith('$')) {
              const paramIdx = parseInt(valPlaceholder.substring(1), 10) - 1;
              row[col] = params[paramIdx];
            } else {
              let val: any = valPlaceholder.replace(/['"]/g, '');
              if (val === 'true') val = true;
              if (val === 'false') val = false;
              if (val === 'null') val = null;
              row[col] = val;
            }
          });
          row.updated_at = new Date().toISOString();
        });

        this.write();
        return { rows: matchingRows };
      }
    }

    // 3. SELECT
    if (lowerSql.startsWith('select')) {
      const match = sql.match(/select\s+(.*?)\s+from\s+(\w+)(?:\s+where\s+(.*?))?(?:\s+order\s+by\s+(.*?))?(?:\s+limit\s+(\d+))?$/i);
      if (match) {
        const fields = match[1];
        const table = match[2].toLowerCase();
        const whereClause = match[3] || '';
        const orderByClause = match[4] || '';
        const limitVal = match[5];

        let rows = [...(this.data[table] || [])];

        // Filter
        rows = this.filterRows(rows, whereClause, params);

        // Sort
        if (orderByClause) {
          const parts = orderByClause.trim().split(' ');
          const col = parts[0].trim();
          const dir = parts[1] ? parts[1].toUpperCase() : 'ASC';

          rows.sort((a, b) => {
            const valA = a[col];
            const valB = b[col];
            if (valA === undefined) return 1;
            if (valB === undefined) return -1;
            if (valA < valB) return dir === 'ASC' ? -1 : 1;
            if (valA > valB) return dir === 'ASC' ? 1 : -1;
            return 0;
          });
        }

        // Limit
        if (limitVal) {
          const limit = parseInt(limitVal, 10);
          rows = rows.slice(0, limit);
        }

        return { rows };
      }
    }

    // 4. DELETE
    if (lowerSql.startsWith('delete from')) {
      const match = sql.match(/delete from (\w+)(?:\s+where\s+(.*))?$/i);
      if (match) {
        const table = match[1].toLowerCase();
        const whereClause = match[2] || '';

        const rows = this.data[table] || [];
        const matchingRows = this.filterRows(rows, whereClause, params);
        
        // Remove matching rows
        this.data[table] = rows.filter(r => !matchingRows.includes(r));
        this.write();
        return { rows: matchingRows };
      }
    }

    console.warn('SQL syntax not parsed by local database driver, executing empty return:', sql);
    return { rows: [] };
  }

  private filterRows(rows: any[], whereClause: string, params: any[]): any[] {
    if (!whereClause) return rows;

    // Split and parse where checks
    // Support simple checks like: col = $1 AND col2 = $2 OR col3 IS NULL
    const clauses = whereClause.split(/\s+and\s+/i);

    return rows.filter(row => {
      return clauses.every(clause => {
        clause = clause.trim();
        if (clause === '1=1' || clause.replace(/\s+/g, '') === '1=1') {
          return true;
        }
        
        // Handle IS NULL check
        if (/is\s+null/i.test(clause)) {
          const col = clause.split(/\s+/)[0].trim();
          return row[col] === null || row[col] === undefined;
        }

        // Handle IS NOT NULL check
        if (/is\s+not\s+null/i.test(clause)) {
          const col = clause.split(/\s+/)[0].trim();
          return row[col] !== null && row[col] !== undefined;
        }

        // Handle equals/comparison operators
        const parts = clause.split(/\s*(=|!=|<>|<|>|<=|>=)\s*/);
        if (parts.length >= 3) {
          const col = parts[0].trim();
          const op = parts[1].trim();
          const valPlaceholder = parts[2].trim();

          let targetVal: any;
          if (valPlaceholder.startsWith('$')) {
            const paramIdx = parseInt(valPlaceholder.substring(1), 10) - 1;
            targetVal = params[paramIdx];
          } else {
            targetVal = valPlaceholder.replace(/['"]/g, '');
            if (targetVal === 'true') targetVal = true;
            if (targetVal === 'false') targetVal = false;
            if (targetVal === 'null') targetVal = null;
          }

          const rowVal = row[col];

          switch (op) {
            case '=':
              return String(rowVal) === String(targetVal);
            case '!=':
            case '<>':
              return String(rowVal) !== String(targetVal);
            case '<':
              return rowVal < targetVal;
            case '>':
              return rowVal > targetVal;
            case '<=':
              return rowVal <= targetVal;
            case '>=':
              return rowVal >= targetVal;
            default:
              return false;
          }
        }

        return true;
      });
    });
  }

  // Pre-seed local database with predefined data
  public seed(seedData: Record<string, any[]>) {
    this.read();
    let seedCount = 0;
    Object.keys(seedData).forEach(table => {
      if (!this.data[table] || this.data[table].length === 0) {
        this.data[table] = seedData[table];
        seedCount++;
      }
    });
    if (seedCount > 0) {
      this.write();
      console.log('Local JSON database seeded with default mock data.');
    }
  }
}

export const localDb = new LocalDatabase();

export const checkPostgresConnection = async (): Promise<boolean> => {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err: any) {
    console.warn('Postgres connection check failed, falling back to local database:', err.message || err);
    try {
      await pool.end();
    } catch (_) {}
    pool = null;
    return false;
  }
};

export const isUsingLocalDb = (): boolean => {
  return pool === null;
};

export const query = async <T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<{ rows: T[] }> => {
  if (pool) {
    try {
      return await pool.query<T>(sql, params);
    } catch (e: any) {
      const isConnectionError = 
        e.code === 'ENOTFOUND' || 
        e.code === 'ECONNREFUSED' || 
        e.code === 'ETIMEDOUT' || 
        e.code === 'EHOSTUNREACH' ||
        (e.message && (
          e.message.includes('getaddrinfo') || 
          e.message.includes('connect') ||
          e.message.includes('timeout')
        ));
      if (isConnectionError) {
        console.error('Postgres connection error, falling back to local file query:', e);
        console.warn('Postgres connection failed. Disabling Postgres pool and falling back to local file database.');
        try {
          await pool.end();
        } catch (_) {}
        pool = null;
        return localDb.query(sql, params);
      }
      // If it's a syntax or schema error, throw it so the app/developer is aware instead of failing silently with empty local db returns
      throw e;
    }
  } else {
    return localDb.query(sql, params);
  }
};

export const withTransaction = async <T>(callback: (client: any) => Promise<T>): Promise<T> => {
  if (pool) {
    let client: any;
    try {
      client = await pool.connect();
    } catch (err: any) {
      console.error('Postgres transaction connection error, falling back to local database:', err);
      const isConnectionError = 
        err.code === 'ENOTFOUND' || 
        err.code === 'ECONNREFUSED' || 
        err.code === 'ETIMEDOUT' || 
        err.code === 'EHOSTUNREACH' ||
        (err.message && (
          err.message.includes('getaddrinfo') || 
          err.message.includes('connect') ||
          err.message.includes('timeout')
        ));
      if (isConnectionError) {
        console.warn('Postgres connection failed. Disabling Postgres pool and falling back to local file database.');
        try {
          await pool.end();
        } catch (_) {}
        pool = null;
      }
      const mockClient = {
        query: async (sql: string, params?: any[]) => {
          return localDb.query(sql, params);
        }
      };
      return await callback(mockClient);
    }

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } else {
    // Fallback to local DB (runs synchronously in JS single thread anyway)
    const mockClient = {
      query: async (sql: string, params?: any[]) => {
        return localDb.query(sql, params);
      }
    };
    return await callback(mockClient);
  }
};


