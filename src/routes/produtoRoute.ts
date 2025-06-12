import { Router } from 'express';
import {
  listarProdutos,
  obterProdutoPorId,
  criarProduto
} from '../controllers/produtoController';

const router = Router();

router.get('/', listarProdutos);          // Público
router.get('/:id', obterProdutoPorId);    // Público
router.post('/', criarProduto);           // Protegido? (Depende de regra de cargo: ADMIN ou GERENTE)

export default router;