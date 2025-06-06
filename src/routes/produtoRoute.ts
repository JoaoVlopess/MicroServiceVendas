import { Router } from 'express';
import { listarProdutos, obterProdutoPorId } from '../controllers/produtoController';

const router = Router();

router.get('/', listarProdutos); // Listar cursos pode ser público
router.get('/:id', obterProdutoPorId);

export default router;