// c:\Users\RDGE\OneDrive\Área de Trabalho\lopes\MicroServiceVendas\config.ts
import dotenv from 'dotenv';
import path from 'path';

// Garante que o .env da raiz do projeto seja carregado
dotenv.config({ path: path.resolve(__dirname, '.env') });

export const DB_HOST = process.env.DB_HOST;
export const DB_USER = process.env.DB_USER;
export const DB_PASS = process.env.DB_PASS;
export const DB_NAME = process.env.DB_NAME;
export const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

// Porta do servidor - usa process.env.PORT (comum em plataformas de deploy) ou um padrão.
export const SERVER_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Exemplo para JWT_SECRET, adicione se for usar autenticação JWT
export const JWT_SECRET = process.env.JWT_SECRET;

// Verificações para variáveis críticas de ambiente
if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("ERRO FATAL: Variáveis de configuração do banco de dados (DB_HOST, DB_USER, DB_NAME) não estão definidas no arquivo .env!");
  process.exit(1);
}

// Descomente e ajuste se for usar JWT
// if (!JWT_SECRET) {
//   console.error("ERRO FATAL: JWT_SECRET não está definido no arquivo .env!");
//   process.exit(1);
// }
