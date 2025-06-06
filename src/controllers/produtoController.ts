import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../database';
import type { ProdutoBase } from '../types/produtos/produtoBase';
// import { pool } from '../db'; // Descomente e ajuste o caminho para seu arquivo de conexão com o BD

// @route   GET /api/produtos
// @desc    Lista todos os produtos disponíveis
// @access  Public (ou Private, se necessitar de autenticação)


export const listarProdutos = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Substitua o mock pela lógica do banco de dados:
    const [rows] = await pool.execute<RowDataPacket[] & ProdutoBase[]>(
      `SELECT id, nome, preco, tipo, descricao FROM produto ORDER BY nome ASC`
    );
    // res.status(200).json({ success: true, data: rows });

    // Por enquanto, mantendo o mock para o código funcionar sem o BD configurado:
    res.status(200).json({ success: true, data: rows });
  } catch (err: any) {
    console.error("Erro ao buscar todos os produtos:", err);
    next(err); // Passa o erro para o próximo middleware de erro
  }
};