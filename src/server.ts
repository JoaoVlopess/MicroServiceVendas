import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
import { SERVER_PORT as CONFIG_SERVER_PORT } from '../config'; // Importar e renomear para clareza
import './database'; // Importar para garantir que a conexão seja testada na inicialização

const server = express();
// const PORT = 3000; // Usaremos SERVER_PORT de config.ts

server.use(helmet());

const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
const localDefaultOrigin = 'http://localhost:5173'; // Para desenvolvimento local
const railwayInternalDefaultOrigin = 'https://microservicevendas.railway.internal'; // URL interna do Railway

const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map(origin => origin.trim()) // Suporta múltiplas origens separadas por vírgula
  : [localDefaultOrigin, railwayInternalDefaultOrigin]; // Padrões se CORS_ALLOWED_ORIGINS não estiver definida

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Permitir requisições sem 'origin' (ex: mobile apps, Postman, curl) ou se a origem estiver na lista de permitidas
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || (allowedOrigins.includes('*') && origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'], 
  optionsSuccessStatus: 200 
};
server.use(cors(corsOptions)); 


server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.use(routes); // Adicione esta linha para usar suas rotas

// Middleware de tratamento de erros genérico (opcional, mas recomendado)
server.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Erro não tratado:", err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Ocorreu um erro interno no servidor.',
  });
});

// Prioriza a porta do ambiente (ex: Railway), depois a do arquivo de config, e por último um padrão.
const PORT = process.env.PORT || CONFIG_SERVER_PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT} em http://localhost:${PORT}`);
});