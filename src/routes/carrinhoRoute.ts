import { Router } from 'express';
import {
  listarProdutosDoCarrinho,
  adicionarProdutoAoCarrinho,
  removerProdutoDoCarrinho,
  esvaziarCarrinho
} from '../controllers/carrinhoController';

const router = Router();

// Lista os itens do carrinho de um usuário específico
router.get('/:id', listarProdutosDoCarrinho);

// Adiciona item ao carrinho de um usuário
router.post('/adicionar', adicionarProdutoAoCarrinho);

// Remove completamente um item específico do carrinho (idProduto como parâmetro, idCliente no body)
router.delete('/remover/:idProduto', removerProdutoDoCarrinho);

// Esvazia completamente o carrinho do usuário (idCliente no body)
router.delete('/esvaziar', esvaziarCarrinho);

export default router;