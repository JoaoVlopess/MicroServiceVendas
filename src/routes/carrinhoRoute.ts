import { Router } from 'express';
import { listarProdutosDoCarrinho, adicionarProdutoAoCarrinho } from '../controllers/carrinhoController';

const router = Router();
 
router.get('/:idCliente', listarProdutosDoCarrinho); // Rota para listar produtos do carrinho de um cliente específico
router.post('/adicionar', adicionarProdutoAoCarrinho); // Rota para adicionar produto ao carrinho

export default router;