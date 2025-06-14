import { Router } from 'express';
import {
  listarProdutos,
  obterProdutoPorId,
  criarProduto,
  atualizarProduto,
  deletarProduto
} from '../controllers/produtoController';

const router = Router();

router.get('/', listarProdutos);          // Público
router.get('/:id', obterProdutoPorId);    // Público
router.post('/', criarProduto);           // Protegido? (Depende de regra de cargo: ADMIN ou GERENTE)
router.put('/:id', atualizarProduto);
router.delete('/:id', deletarProduto);

export default router;