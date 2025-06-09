import { Router, Request, Response } from "express";
import produtoRoute from "./produtoRoute";
import carrinhoRoute from "./carrinhoRoute"; // Importar a rota do carrinho

const router = Router();

router.get('/', (req: Request, res: Response) => {
 res.send('API Vendas-Service está operacional!');
});


router.get('/health', (req: Request, res: Response) => {
  // Lógica de verificação de saúde mais complexa pode ser adicionada aqui
  // (ex: verificar conexão com banco de dados, outros serviços críticos)
  res.status(200).json({ status: 'UP' });
});

router.get('/info', (req: Request, res: Response) => {
  // Pode retornar informações da aplicação, como versão, nome, etc.
  res.status(200).json({
    name: 'VENDAS-SERVICE',
    description: 'Microsserviço de Vendas',
    status: 'UP',
    // version: '1.0.0' // Exemplo
  });
});
router.use('/produtos', produtoRoute);
router.use('/carrinho', carrinhoRoute); // Corrigir para usar carrinhoRoute

export default router;