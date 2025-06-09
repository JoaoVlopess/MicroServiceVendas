import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
import { SERVER_PORT as CONFIG_SERVER_PORT } from '../config'; // Importar e renomear para clareza
import './database'; // Importar para garantir que a conexão seja testada na inicialização
import { Eureka } from 'eureka-js-client';


const server = express();
// const PORT = 3000; // Usaremos SERVER_PORT de config.ts

server.use(helmet());

const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;
const localDefaultOrigin = 'http://localhost:5173'; // Para desenvolvimento local
const railwayInternalDefaultOrigin = 'https://microservicevendas.railway.internal'; // URL interna do Railway

let calculatedOrigins = [localDefaultOrigin, railwayInternalDefaultOrigin];

if (allowedOriginsEnv) {
  const envOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim());
  // Adiciona as origens do ambiente à lista base, evitando duplicatas
  calculatedOrigins = Array.from(new Set([...calculatedOrigins, ...envOrigins]));
}
// Se CORS_ALLOWED_ORIGINS não estiver definida, calculatedOrigins permanece [localDefaultOrigin, railwayInternalDefaultOrigin]
const allowedOrigins = calculatedOrigins;

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

// 2. Configuração do cliente Eureka
// TODO: Para produção no Railway, 'hostName' e 'ipAddr' podem precisar ser ajustados
// para a URL pública ou interna do serviço, dependendo da configuração do Eureka Server.
// Por exemplo, usar process.env.RAILWAY_STATIC_URL ou uma variável de ambiente específica.
const eurekaClient = new Eureka({
    instance: {
        app: 'VENDAS-SERVICE', // Nome exato que aparecerá no painel Eureka
        hostName: process.env.EUREKA_INSTANCE_HOSTNAME || 'localhost', // Usar variável de ambiente ou localhost
        ipAddr: process.env.EUREKA_INSTANCE_IPADDR || '127.0.0.1',    // Usar variável de ambiente ou IP local
        statusPageUrl: `http://${process.env.EUREKA_INSTANCE_HOSTNAME || 'localhost'}:${PORT}/info`, // Opcional
        healthCheckUrl: `http://${process.env.EUREKA_INSTANCE_HOSTNAME || 'localhost'}:${PORT}/health`, // Opcional
        port: {
            '$': PORT, // Usa a porta em que o servidor está rodando
            '@enabled': true,
        },
        vipAddress: 'vendas-service', // Identificador do serviço
        dataCenterInfo: {
            '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
            name: 'MyOwn', // Ou 'Amazon' se estiver na AWS, etc.
        },
    },
    eureka: {
        host: process.env.EUREKA_SERVER_HOST || 'localhost', // Host do Eureka Server (via env var)
        port: parseInt(process.env.EUREKA_SERVER_PORT || '8761', 10), // Porta do Eureka Server (via env var)
        servicePath: process.env.EUREKA_SERVICE_PATH || '/eureka/apps/', // Caminho do serviço Eureka (via env var)
    },
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT} em http://localhost:${PORT}`);
    // 3. Inicia o registro no Eureka e trata possíveis erros
  eurekaClient.start((error: Error) => {
      if (error) {
          console.error('❌ Erro ao registrar no Eureka:', error);
      } else {
          console.log('✅ Serviço de Vendas registrado no Eureka com sucesso!');
      }
  });
});