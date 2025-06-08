import { Router } from 'express';
import { listarProdutosDoCarrinho, adicionarProdutoAoCarrinho, removerProdutoDoCarrinho } from '../controllers/carrinhoController';

const router = Router();
 
router.get('/:idCliente', listarProdutosDoCarrinho); // Rota para listar produtos do carrinho de um cliente específico
router.post('/adicionar', adicionarProdutoAoCarrinho); // Rota para adicionar produto ao carrinho
router.post('/remover', removerProdutoDoCarrinho); // Rota para remover produto do carrinho

export default router;