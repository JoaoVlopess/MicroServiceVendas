import { Router } from 'express';
import {
  listarProdutosDoCarrinho,
  adicionarProdutoAoCarrinho,
  removerProdutoDoCarrinho
} from '../controllers/carrinhoController';

const router = Router();

// Todas as rotas dependem de autenticação e leitura do cabeçalho X-User-ID
router.get('/', listarProdutosDoCarrinho);        // Lista os itens do carrinho do usuário autenticado
router.post('/adicionar', adicionarProdutoAoCarrinho); // Adiciona item ao carrinho do usuário autenticado
router.post('/remover', removerProdutoDoCarrinho);     // Remove item do carrinho do usuário autenticado

export default router;
