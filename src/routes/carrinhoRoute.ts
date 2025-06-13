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

// Remove completamente um item específico do carrinho (idCliente e idCarrinho na URL, idProduto como parâmetro)
router.delete('/:idCliente/:idCarrinho/remover/:idProduto', removerProdutoDoCarrinho);

// Esvazia completamente o carrinho do usuário (idCliente e idCarrinho na URL)
router.delete('/:idCliente/:idCarrinho/esvaziar', esvaziarCarrinho);

export default router;