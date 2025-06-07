import { Router, Request, Response } from "express";
import produtoRoute from "./produtoRoute";
import carrinhoRoute from "./carrinhoRoute"; // Importar a rota do carrinho

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.send('API Plataforma Cursos está operacional!');
});

router.use('/produtos', produtoRoute);
router.use('/carrinho', carrinhoRoute); // Corrigir para usar carrinhoRoute

export default router;