// server/src/database.ts (ou onde você cria o pool)
import mysql from 'mysql2/promise';
// Certifique-se que estas constantes vêm do seu arquivo config.ts que usa dotenv
import { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT } from '../config';

console.log("🔍 Conectando ao Banco de Dados com:", {
  host: DB_HOST,
  user: DB_USER,
  // NÃO logar a senha em produção!
  database: DB_NAME,
  port: DB_PORT
});

const dbConfig = {
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10, // Limite de conexões do Railway pode ser menor no plano gratuito
  queueLimit: 0,
  timezone: 'Z', // Boa prática para consistência de datas
  // namedPlaceholders: true, // Remova se não estiver usando ou se causar problemas
};

const pool = mysql.createPool(dbConfig);

export async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('pingando...');
    await connection.ping();
    console.log('✅ Conexão com MySQL estabelecida via pool!');
    return true;
  } catch (error: unknown) {
    console.error('❌ Falha na conexão com MySQL:', error);
    // Não relance o erro aqui se você já vai tratar no 'catch' do testConnection()
    // throw error;
    return false; // Retorna false em caso de erro
  } finally {
    if (connection) connection.release();
  }
}

export { pool };

// Teste a conexão ao iniciar (bom para desenvolvimento)
testConnection()
  .then((isConnected) => {
    if (isConnected) {
      console.log('📊 Pronto para consultas ao banco de dados na nuvem!');
    } else {
      console.error('🛑 Encerrando aplicação devido a erro de conexão com o banco na nuvem.');
      process.exit(1); // Encerra se não conseguir conectar
    }
  })
  .catch(() => {
    // Este catch é mais para erros inesperados no próprio testConnection
    console.error('🛑 Erro crítico no processo de teste de conexão.');
    process.exit(1);
  });