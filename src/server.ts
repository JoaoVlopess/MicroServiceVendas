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
const vercelFrontendOrigin = 'https://vet-fofinhos-ronaldo.vercel.app'; // Frontend na Vercel
const railwayInternalDefaultOrigin = 'https://microservicevendas.railway.internal'; // URL interna do Railway

let calculatedOrigins = [localDefaultOrigin, vercelFrontendOrigin, railwayInternalDefaultOrigin];

if (allowedOriginsEnv) {
  const envOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim());
  // Adiciona as origens do ambiente à lista base, evitando duplicatas
  calculatedOrigins = Array.from(new Set([...calculatedOrigins, ...envOrigins]));
}
// Se CORS_ALLOWED_ORIGINS não estiver definida, calculatedOrigins permanece [localDefaultOrigin, railwayInternalDefaultOrigin]
const allowedOrigins = calculatedOrigins; // Agora inclui a Vercel por padrão se não houver env var

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

const EUREKA_SERVER_URL_FALLBACK = 'https://eurekaronaldo-production.up.railway.app/'; // URL do Eureka atualizada
const eurekaServiceUrl = process.env.EUREKA_URL || EUREKA_SERVER_URL_FALLBACK;

// 2. Configuração do cliente Eureka para Railway e desenvolvimento local
// TODO: Para produção no Railway, 'hostName' e 'ipAddr' podem precisar ser ajustados
// para a URL pública ou interna do serviço, dependendo da configuração do Eureka Server.
// Por exemplo, usar process.env.RAILWAY_STATIC_URL ou uma variável de ambiente específica.
const eurekaClient = new Eureka({
    instance: {
        app: 'VENDAS-SERVICE', // Nome exato que aparecerá no painel Eureka
       // No Railway, RAILWAY_PRIVATE_IP é preferível para comunicação interna entre serviços.
        // Para hostName, pode ser o RAILWAY_STATIC_URL se o Eureka Server estiver externo e precisar de um nome DNS resolvível,
        // ou RAILWAY_PRIVATE_IP se o Eureka Server estiver na mesma rede privada.
        // Se RAILWAY_PRIVATE_IP não estiver disponível (ex: local dev), usa 'localhost'.
        hostName: process.env.RAILWAY_PRIVATE_IP || 'localhost',
        ipAddr: process.env.RAILWAY_PRIVATE_IP || '127.0.0.1',
        
        port: {
            // A porta é dinamicamente atribuída pelo Railway (process.env.PORT) ou usa a SERVER_PORT definida
            '$': parseInt(process.env.PORT || (CONFIG_SERVER_PORT ? CONFIG_SERVER_PORT.toString() : '3000'), 10),
            '@enabled': true,
        },
        vipAddress: 'vendas-service', // Identificador do serviço
        // Para o Railway, as URLs de status e health check devem usar o domínio público e HTTPS
        // Se RAILWAY_PUBLIC_DOMAIN não estiver disponível (ex: dev local), usa localhost com HTTP e a porta da instância.
        statusPageUrl: process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/info`
            : `http://localhost:${PORT}/info`,
        healthCheckUrl: process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`
            : `http://localhost:${PORT}/health`,
        dataCenterInfo: {
            '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
            name: 'MyOwn', // Pode ser 'Default' ou 'MyOwn' para ambientes não-AWS. 'Amazon' se na AWS.
        },
    },
    eureka: {
       // Usa a URL completa do Eureka, que é mais robusto
        serviceUrls: {
            default: [ `${eurekaServiceUrl}/eureka/apps/` ]
        },
        // Informa ao cliente para usar o protocolo HTTPS se a URL começar com https
        ssl: eurekaServiceUrl.startsWith('https://'),
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