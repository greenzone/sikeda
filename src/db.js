/* ============================================================
   SIKEDA — Koneksi MySQL (pool) + helper query
   ============================================================ */
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_system_sikeda',
  waitForConnections: true,
  connectionLimit: process.env.VERCEL ? 4 : 10, /* serverless: hemat koneksi */
  queueLimit: 0,
  charset: 'utf8mb4_general_ci',
  dateStrings: true, /* DATE/DATETIME sebagai string 'YYYY-MM-DD' */
  enableKeepAlive: true, /* Vercel: hindari reconnect per request */
  keepAliveInitialDelay: 10000
});

/* Helper: query dengan placeholder */
async function q(sql, params){
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/* Helper: transaksi */
async function withTransaction(fn){
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch(err){
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, q, withTransaction };
