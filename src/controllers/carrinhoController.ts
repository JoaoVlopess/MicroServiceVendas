import { Request, Response, NextFunction } from 'express';
import type { Carrinho } from '../types/carrinho/carrinho';
import type { ItemCarrinho } from '../types/carrinho/itemCarrinho';
import { pool } from '../database'; // Importar o pool de conexões
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { ProdutoBase } from '../types/produtos/produtoBase'; // Assumindo que ProdutoBase tem nome e preco

// Função auxiliar para calcular e atualizar o total do carrinho
async function atualizarTotalCarrinho(idCarrinho: number): Promise<number> {
  const [itensResult] = await pool.execute<RowDataPacket[] & { quantidade: number; preco_unitario_no_momento_da_adicao: number }[]>(
    `SELECT quantidade, preco_unitario_no_momento_da_adicao FROM ItensCarrinho WHERE id_carrinho = ?`,
    [idCarrinho]
  );

  const novoTotal = itensResult.reduce((sum, item) => sum + (item.quantidade * item.preco_unitario_no_momento_da_adicao), 0);

  await pool.execute(
    `UPDATE Carrinhos SET total = ?, data_ultima_modificacao = NOW() WHERE id = ?`,
    [novoTotal, idCarrinho]
  );
  return novoTotal;
}

// @route   GET /carrinho
// @desc    Lista todos os produtos no carrinho do usuário (mockado)
// @access  Private (geralmente requer autenticação para saber qual carrinho buscar)
export const listarProdutosDoCarrinho = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { idCliente } = req.params;

  try {
    const [carrinhos] = await pool.execute<RowDataPacket[] & Carrinho[]>(
      `SELECT id as idCarrinho, id_cliente as idUsuario, total, data_criacao, data_ultima_modificacao 
       FROM Carrinhos WHERE id_cliente = ?`,
      [idCliente]
    );

    if (carrinhos.length === 0) {
      res.status(200).json({ success: true, message: 'Carrinho vazio ou não encontrado para este cliente.', data: { idUsuario: parseInt(idCliente), itens: [], total: 0 } });
      return;
    }

    const carrinho = carrinhos[0];

    const [itensDB] = await pool.execute<RowDataPacket[] & { id_produto: number; quantidade: number; preco_unitario_no_momento_da_adicao: number; nome_produto: string; }[]>(
      `SELECT 
         ic.id_produto as idProduto, 
         ic.quantidade, 
         ic.preco_unitario_no_momento_da_adicao as preco, 
         pb.nome 
       FROM ItensCarrinho ic
       JOIN ProdutoBase pb ON ic.id_produto = pb.id
       WHERE ic.id_carrinho = ?`,
      [carrinho.idCarrinho]
    );
    
    // Mapeia para o formato ItemCarrinho da resposta, que inclui nome e preço
    const itensFormatados: (ItemCarrinho & { nome: string; preco: number })[] = itensDB.map(item => ({
        idProduto: item.idProduto,
        quantidade: item.quantidade,
        nome: item.nome_produto,
        preco: item.preco_unitario_no_momento_da_adicao,
    }));

    res.status(200).json({ success: true, data: { ...carrinho, itens: itensFormatados } });
  } catch (err: any) {
    console.error("Erro ao buscar produtos do carrinho:", err);
    next(err); // Passa o erro para o próximo middleware de erro
  }
};

// @route   POST /carrinho/adicionar
// @desc    Adiciona um produto ao carrinho ou atualiza sua quantidade
// @access  Private
export const adicionarProdutoAoCarrinho = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idCliente, idProduto, quantidade } = req.body as { idCliente: number, idProduto: number, quantidade: number };

    if (idCliente === undefined || idProduto === undefined || quantidade === undefined) {
      res.status(400).json({ success: false, message: 'idCliente, idProduto e quantidade são obrigatórios.' });
      return;
    }

    if (typeof quantidade !== 'number' || quantidade <= 0) {
      res.status(400).json({ success: false, message: 'Quantidade deve ser um número positivo.' });
      return;
    }

    // 1. Buscar informações do produto no banco de dados
    const [rows] = await pool.execute<RowDataPacket[] & ProdutoBase[]>(
      `SELECT id, preco FROM ProdutoBase WHERE id = ?`, // Apenas o preço é necessário aqui
      [idProduto]
    );

    const produtoInfo = rows[0];

    if (!produtoInfo) {
      res.status(404).json({ success: false, message: 'Produto não encontrado.' });
      return;
    }
    const precoProdutoNoMomento = produtoInfo.preco;

    // 2. Encontrar ou criar o carrinho para o cliente
    let idCarrinho: number;
    const [carrinhos] = await pool.execute<RowDataPacket[] & { id: number }[]>(
      `SELECT id FROM Carrinhos WHERE id_cliente = ?`,
      [idCliente]
    );

    if (carrinhos.length > 0) {
      idCarrinho = carrinhos[0].id;
    } else {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Carrinhos (id_cliente, data_criacao, data_ultima_modificacao, total) VALUES (?, NOW(), NOW(), 0)`,
        [idCliente]
      );
      idCarrinho = result.insertId;
    }

    // 3. Adicionar ou atualizar o item no carrinho
    // Usamos INSERT ... ON DUPLICATE KEY UPDATE para simplificar
    await pool.execute(
      `INSERT INTO ItensCarrinho (id_carrinho, id_produto, quantidade, preco_unitario_no_momento_da_adicao) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade), preco_unitario_no_momento_da_adicao = VALUES(preco_unitario_no_momento_da_adicao)`,
      [idCarrinho, idProduto, quantidade, precoProdutoNoMomento]
    );

    // 4. Atualizar o total do carrinho
    await atualizarTotalCarrinho(idCarrinho);

    // 5. Buscar o carrinho atualizado para retornar na resposta
    const [carrinhoAtualizadoRows] = await pool.execute<RowDataPacket[] & Carrinho[]>(
        `SELECT id as idCarrinho, id_cliente as idUsuario, total, data_criacao, data_ultima_modificacao 
         FROM Carrinhos WHERE id = ?`,
        [idCarrinho]
      );
    const carrinhoAtualizado = carrinhoAtualizadoRows[0];

    const [itensDB] = await pool.execute<RowDataPacket[] & { id_produto: number; quantidade: number; preco_unitario_no_momento_da_adicao: number; nome_produto: string; }[]>(
        `SELECT ic.id_produto as idProduto, ic.quantidade, ic.preco_unitario_no_momento_da_adicao as preco, pb.nome as nome_produto
         FROM ItensCarrinho ic
         JOIN ProdutoBase pb ON ic.id_produto = pb.id
         WHERE ic.id_carrinho = ?`,
        [idCarrinho]
    );
    
    const itensFormatados: (ItemCarrinho & { nome: string; preco: number })[] = itensDB.map(item => ({
        idProduto: item.idProduto,
        quantidade: item.quantidade,
        nome: item.nome_produto,
        preco: item.preco_unitario_no_momento_da_adicao,
    }));

    res.status(200).json({ success: true, message: 'Produto adicionado/atualizado no carrinho!', data: { ...carrinhoAtualizado, itens: itensFormatados } });
  } catch (err: any) {
    console.error("Erro ao adicionar produto ao carrinho:", err);
    next(err);
  }
};