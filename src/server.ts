import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes'; // Importar o router principal
import { SERVER_PORT } from '../config'; // Importar a porta do config
import './database'; // Importar para garantir que a conexão seja testada na inicialização

const server = express();
// const PORT = 3000; // Usaremos SERVER_PORT de config.ts

server.use(helmet());

const corsOptions = {
  origin: 'http://localhost:5173', 
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

server.listen(SERVER_PORT, () => { // Iniciar o servidor
  console.log(`🚀 Servidor rodando na porta ${SERVER_PORT} em http://localhost:${SERVER_PORT}`);
});