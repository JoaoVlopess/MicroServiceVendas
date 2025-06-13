import { Request, Response, NextFunction } from 'express';
import type { Carrinho } from '../types/carrinho/carrinho';
import type { ItemCarrinho } from '../types/carrinho/itemCarrinho';
import { pool } from '../database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import type { ProdutoBase } from '../types/produtos/produtoBase';

// Função auxiliar para calcular e atualizar o total do carrinho
async function atualizarTotalCarrinho(connection: PoolConnection, idCarrinho: number): Promise<number> {
  const [itensResult] = await connection.execute<RowDataPacket[] & { quantidade: number; preco: number }[]>(
    `SELECT ic.quantidade, pb.preco 
     FROM ItemCarrinho ic
     JOIN ProdutoBase pb ON ic.idProduto = pb.id
     WHERE ic.idCarrinho = ?`,
    [idCarrinho]
  );

  const novoTotal = itensResult.reduce((sum, item) => sum + (item.quantidade * item.preco), 0);

  await connection.execute(
    `UPDATE Carrinho SET total = ?, dataUltimaModificacao = NOW() WHERE idCarrinho = ?`,
    [novoTotal, idCarrinho]
  );
  return novoTotal;
}

// Função auxiliar para buscar e formatar os detalhes completos do carrinho
async function obterDetalhesCarrinhoFormatado(connection: PoolConnection | typeof pool, idCarrinho: number): Promise<{ carrinho: Carrinho | null, itens: (ItemCarrinho & { nome: string; preco: number })[] }> {
  const [carrinhoRows] = await connection.execute<RowDataPacket[] & Carrinho[]>(
    `SELECT idCarrinho, idUsuario, total, dataCriacao, dataUltimaModificacao 
     FROM Carrinho WHERE idCarrinho = ?`,
    [idCarrinho]
  );

  if (carrinhoRows.length === 0) {
    return { carrinho: null, itens: [] };
  }
  const carrinho = carrinhoRows[0];

  const [itensDB] = await connection.execute<RowDataPacket[] & { idProduto: number; quantidade: number; preco: number; nome_produto: string; }[]>(
    `SELECT
        ic.idProduto as idProduto,
       ic.quantidade, 
       pb.preco as preco,
       pb.nome as nome_produto
     FROM ItemCarrinho ic
     JOIN ProdutoBase pb ON ic.idProduto = pb.id 
     WHERE ic.idCarrinho = ?`,
    [idCarrinho]
  );

  const itensFormatados = itensDB.map(item => ({
    idProduto: item.idProduto,
    quantidade: item.quantidade,
    nome: item.nome_produto,
    preco: item.preco,
  }));

  return { carrinho, itens: itensFormatados };
}

// GET /carrinho/:id
export const listarProdutosDoCarrinho = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const idUsuario = parseInt(req.params.id);

  if (isNaN(idUsuario)) {
    res.status(400).json({ success: false, message: 'ID de usuário inválido nos parâmetros da URL.' });
    return;
  }

  try {
    const [carrinhosResult] = await pool.execute<RowDataPacket[] & { idCarrinho: number }[]>(
      `SELECT idCarrinho FROM Carrinho WHERE idUsuario = ?`,
      [idUsuario]
    );

    if (carrinhosResult.length === 0) {
      res.status(200).json({
        success: true,
        message: 'Carrinho vazio ou não encontrado para este cliente.',
        data: { idUsuario, itens: [], total: 0, idCarrinho: null, dataCriacao: null, dataUltimaModificacao: null }
      });
      return;
    }

    const idCarrinho = carrinhosResult[0].idCarrinho;

    const { carrinho, itens } = await obterDetalhesCarrinhoFormatado(pool, idCarrinho);

    if (!carrinho) {
      res.status(404).json({ success: false, message: 'Carrinho não encontrado após verificação inicial.' });
      return;
    }
    res.status(200).json({ success: true, data: { ...carrinho, itens } });
  } catch (err: any) {
    console.error("Erro ao buscar produtos do carrinho:", err);
    next(err);
  }
};

// POST /carrinho/adicionar
export const adicionarProdutoAoCarrinho = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let connection: PoolConnection | null = null;
  try {
    const { idProduto, quantidade, idCliente } = req.body as { idProduto: number, quantidade: number, idCliente?: number };

    if (!idCliente || typeof idCliente !== 'number') {
      res.status(400).json({ success: false, message: 'idCliente deve ser fornecido no corpo da requisição.' });
      return;
    }

    if (idProduto === undefined || quantidade === undefined) {
      res.status(400).json({ success: false, message: 'idProduto e quantidade são obrigatórios.' });
      return;
    }

    if (typeof quantidade !== 'number' || quantidade <= 0) {
      res.status(400).json({ success: false, message: 'Quantidade deve ser um número positivo.' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<RowDataPacket[] & ProdutoBase[]>(
      `SELECT id, nome, preco, tipo, descricao FROM ProdutoBase WHERE id = ?`,
      [idProduto]
    );

    const produtoInfo = rows[0];

    if (!produtoInfo) {
      res.status(404).json({ success: false, message: 'Produto não encontrado.' });
      return;
    }

    let idCarrinho: number;
    const [carrinhosResult] = await connection.execute<RowDataPacket[] & { idCarrinho: number }[]>(
      `SELECT idCarrinho FROM Carrinho WHERE idUsuario = ?`,
      [idCliente]
    );

    if (carrinhosResult.length > 0) {
      idCarrinho = carrinhosResult[0].idCarrinho;
    } else {
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO Carrinho (idUsuario, dataCriacao, dataUltimaModificacao, total) VALUES (?, NOW(), NOW(), 0)`,
        [idCliente]
      );
      idCarrinho = insertResult.insertId;
    }

    await connection.execute(
      `INSERT INTO ItemCarrinho (idCarrinho, idProduto, quantidade)
       VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantidade = quantidade + 1`,

      [idCarrinho, idProduto, quantidade]
    );

    await atualizarTotalCarrinho(connection, idCarrinho);

    const { carrinho: carrinhoAtualizado, itens: itensFormatados } = await obterDetalhesCarrinhoFormatado(connection, idCarrinho);

    await connection.commit();

    if (!carrinhoAtualizado) {
      res.status(500).json({ success: false, message: 'Erro ao buscar carrinho atualizado.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Produto adicionado/atualizado no carrinho!', data: { ...carrinhoAtualizado, itens: itensFormatados } });
  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("Erro ao adicionar produto ao carrinho:", err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

// DELETE /carrinho/remover/:idProduto
export const removerProdutoDoCarrinho = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let connection: PoolConnection | null = null;
  try {
    const idProduto = parseInt(req.params.idProduto);
    const { idCliente } = req.body as { idCliente?: number };

    if (!idCliente || typeof idCliente !== 'number' || isNaN(idProduto)) {
      res.status(400).json({ success: false, message: 'idCliente e idProduto devem ser fornecidos corretamente.' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [carrinhosResult] = await connection.execute<RowDataPacket[] & { idCarrinho: number }[]>(
      `SELECT idCarrinho FROM Carrinho WHERE idUsuario = ?`,
      [idCliente]
    );

    if (carrinhosResult.length === 0) {
      res.status(404).json({ success: false, message: 'Carrinho não encontrado para este cliente.' });
      return;
    }

    const idCarrinho = carrinhosResult[0].idCarrinho;

    const [produtoNoCarrinho] = await connection.execute<RowDataPacket[]>(
      `SELECT 1 FROM ItemCarrinho WHERE idCarrinho = ? AND idProduto = ?`,
      [idCarrinho, idProduto]
    );

    if (produtoNoCarrinho.length === 0) {
      res.status(404).json({ success: false, message: 'Produto não encontrado no carrinho.' });
      return;
    }

    await connection.execute(
      `DELETE FROM ItemCarrinho WHERE idCarrinho = ? AND idProduto = ?`,
      [idCarrinho, idProduto]
    );

    await atualizarTotalCarrinho(connection, idCarrinho);

    const { carrinho: carrinhoAtualizado, itens } = await obterDetalhesCarrinhoFormatado(connection, idCarrinho);

    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Produto removido do carrinho.',
      data: carrinhoAtualizado ? { ...carrinhoAtualizado, itens } : null
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("Erro ao remover produto do carrinho:", err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

// DELETE /carrinho/esvaziar
export const esvaziarCarrinho = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let connection: PoolConnection | null = null;
  try {
    const { idCliente } = req.body as { idCliente?: number };

    if (!idCliente || typeof idCliente !== 'number') {
      res.status(400).json({ success: false, message: 'idCliente deve ser fornecido no corpo da requisição.' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [carrinhosResult] = await connection.execute<RowDataPacket[] & { idCarrinho: number }[]>(
      `SELECT idCarrinho FROM Carrinho WHERE idUsuario = ?`,
      [idCliente]
    );

    if (carrinhosResult.length === 0) {
      res.status(404).json({ success: false, message: 'Carrinho não encontrado para este cliente.' });
      return;
    }

    const idCarrinho = carrinhosResult[0].idCarrinho;

    await connection.execute(
      `DELETE FROM ItemCarrinho WHERE idCarrinho = ?`,
      [idCarrinho]
    );

    await connection.execute(
      `UPDATE Carrinho SET total = 0, dataUltimaModificacao = NOW() WHERE idCarrinho = ?`,
      [idCarrinho]
    );

    const { carrinho: carrinhoAtualizado, itens } = await obterDetalhesCarrinhoFormatado(connection, idCarrinho);

    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Carrinho esvaziado com sucesso.',
      data: carrinhoAtualizado ? { ...carrinhoAtualizado, itens } : null
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("Erro ao esvaziar o carrinho:", err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};