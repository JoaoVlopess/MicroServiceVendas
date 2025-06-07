import { Router } from 'express';
import { listarProdutos, obterProdutoPorId, criarProduto } from '../controllers/produtoController';

const router = Router();

router.get('/', listarProdutos); // Listar cursos pode ser público
router.get('/:id', obterProdutoPorId);
router.post('/', criarProduto); // Adicionar rota para criar produto

export default router;