import { Router, Request, Response } from "express";
import produtoRoute from "./produtoRoute";
import carrinhoRoute from "./carrinhoRoute";

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.send('API de Vendas está operacional!');
});

router.use('/produtos', produtoRoute);
router.use('/carrinho', carrinhoRoute);

// Nova rota para /api/contas/clientes
router.get('/api/contas/clientes', (req: Request, res: Response) => {
  res.json({ message: 'Endpoint de clientes' });
});

export { router };