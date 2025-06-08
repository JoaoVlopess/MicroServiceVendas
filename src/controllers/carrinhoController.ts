import { Request, Response, NextFunction } from 'express';
import type { Carrinho } from '../types/carrinho/carrinho';
import type { ItemCarrinho } from '../types/carrinho/itemCarrinho';
import { pool } from '../database'; // Importar o pool de conexões
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { ProdutoBase } from '../types/produtos/produtoBase'; // Assumindo que ProdutoBase tem nome e preco

// Função auxiliar para calcular e atualizar o total do carrinho
async function atualizarTotalCarrinho(idCarrinho: number): Promise<number> {
  const [itensResult] = await pool.execute<RowDataPacket[] & { quantidade: number; preco: number }[]>(
    `SELECT ic.quantidade, pb.preco 
     FROM ItemCarrinho ic
     JOIN ProdutoBase pb ON ic.idProduto = pb.id
     WHERE ic.idCarrinho = ?`,
    [idCarrinho]
  );

  const novoTotal = itensResult.reduce((sum, item) => sum + (item.quantidade * item.preco), 0);

  await pool.execute(
    `UPDATE Carrinho SET total = ?, dataUltimaModificacao = NOW() WHERE idCarrinho = ?`,
    [novoTotal, idCarrinho]
  );
  return novoTotal;
}

// Função auxiliar para buscar e formatar os detalhes completos do carrinho
async function obterDetalhesCarrinhoFormatado(idCarrinho: number): Promise<{ carrinho: Carrinho | null, itens: (ItemCarrinho & { nome: string; preco: number })[] }> {
  const [carrinhoRows] = await pool.execute<RowDataPacket[] & Carrinho[]>(
    `SELECT idCarrinho, idUsuario, total, dataCriacao, dataUltimaModificacao 
     FROM Carrinho WHERE idCarrinho = ?`,
    [idCarrinho]
  );

  if (carrinhoRows.length === 0) {
    return { carrinho: null, itens: [] };
  }
  const carrinho = carrinhoRows[0];

  const [itensDB] = await pool.execute<RowDataPacket[] & { idProduto: number; quantidade: number; preco: number; nome_produto: string; }[]>(
    `SELECT
        ic.idProduto as idProduto,

       ic.quantidade, 
       pb.preco as preco,
       pb.nome as nome_produto
     FROM ItemCarrinho ic -- ic.idProduto está correto conforme sua DDL de ItemCarrinho
     JOIN ProdutoBase pb ON ic.idProduto = pb.id 
     WHERE ic.idCarrinho = ?`,
    [idCarrinho]
  );

  const itensFormatados = itensDB.map(item => ({
    idProduto: item.idProduto,
    quantidade: item.quantidade,
    nome: item.nome_produto,
      preco: item.preco, // Este é o pb.preco
  }));

  return { carrinho, itens: itensFormatados };
}

// @route   GET /carrinho
// @desc    Lista todos os produtos no carrinho do usuário (mockado)
// @access  Private (geralmente requer autenticação para saber qual carrinho buscar)
export const listarProdutosDoCarrinho = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { idCliente } = req.params;

  try {
    const [carrinhosResult] = await pool.execute<RowDataPacket[] & { idCarrinho: number }[]>(
      `SELECT idCarrinho FROM Carrinho WHERE idUsuario = ?`,
      [idCliente]
    );

    if (carrinhosResult.length === 0) {
      res.status(200).json({
        success: true,
        message: 'Carrinho vazio ou não encontrado para este cliente.',
        data: { idUsuario: parseInt(idCliente), itens: [], total: 0, idCarrinho: null, dataCriacao: null, dataUltimaModificacao: null }
      });
      return;
    }

    const idCarrinho = carrinhosResult[0].idCarrinho;

    const { carrinho, itens } = await obterDetalhesCarrinhoFormatado(idCarrinho);

    if (!carrinho) { // Segurança, embora improvável se carrinhosResult tinha um ID
      res.status(404).json({ success: false, message: 'Carrinho não encontrado após verificação inicial.' });
      return;
    }
    res.status(200).json({ success: true, data: { ...carrinho, itens } });
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
      // Selecionar todos os campos para alinhar com o tipo ProdutoBase, assumindo que ProdutoBase.id é a PK
      `SELECT id, nome, preco, tipo, descricao FROM ProdutoBase WHERE id = ?`,
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
    const [carrinhosResult] = await pool.execute<RowDataPacket[] & { idCarrinho: number }[]>(
      `SELECT idCarrinho FROM Carrinho WHERE idUsuario = ?`,
      [idCliente]
    );

    if (carrinhosResult.length > 0) {
      idCarrinho = carrinhosResult[0].idCarrinho;

    } else {
      // Criar um novo carrinho
      const [insertResult] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Carrinho (idUsuario, dataCriacao, dataUltimaModificacao, total) VALUES (?, NOW(), NOW(), 0)`,
        [idCliente]
      );
      idCarrinho = insertResult.insertId;
    }

    // 3. Adicionar ou atualizar o item no carrinho
    // Usamos INSERT ... ON DUPLICATE KEY UPDATE para simplificar
    await pool.execute(
      `INSERT INTO ItemCarrinho (idCarrinho, idProduto, quantidade)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)`,
      [idCarrinho, idProduto, quantidade]
    );

    // 4. Atualizar o total do carrinho
    await atualizarTotalCarrinho(idCarrinho);

    // 5. Buscar o carrinho atualizado para retornar na resposta
    const { carrinho: carrinhoAtualizado, itens: itensFormatados } = await obterDetalhesCarrinhoFormatado(idCarrinho);

    if (!carrinhoAtualizado) {
      // Este caso não deveria acontecer se o carrinho acabou de ser criado/encontrado
      res.status(500).json({ success: false, message: 'Erro ao buscar carrinho atualizado.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Produto adicionado/atualizado no carrinho!', data: { ...carrinhoAtualizado, itens: itensFormatados } });
  } catch (err: any) {
    console.error("Erro ao adicionar produto ao carrinho:", err);
    next(err);
  }
};

// @route   POST /carrinho/remover
// @desc    Remove um produto do carrinho ou diminui sua quantidade
// @access  Private
export const removerProdutoDoCarrinho = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idCliente, idProduto, quantidade: quantidadeParaRemover } = req.body as { idCliente: number, idProduto: number, quantidade?: number };

    if (idCliente === undefined || idProduto === undefined) {
      res.status(400).json({ success: false, message: 'idCliente e idProduto são obrigatórios.' });
      return;
    }
    if (quantidadeParaRemover !== undefined && (typeof quantidadeParaRemover !== 'number' || quantidadeParaRemover <= 0)) {
      res.status(400).json({ success: false, message: 'Quantidade para remover deve ser um número positivo.' });
      return;
    }

    // 1. Encontrar o carrinho do cliente
    const [carrinhosResult] = await pool.execute<RowDataPacket[] & { idCarrinho: number }[]>(
      `SELECT idCarrinho FROM Carrinho WHERE idUsuario = ?`,
      [idCliente]
    );

    if (carrinhosResult.length === 0) {
      res.status(404).json({ success: false, message: 'Carrinho não encontrado para este cliente.' });
      return;
    }
    const idCarrinho = carrinhosResult[0].idCarrinho;


    // 2. Verificar se o item existe no carrinho e obter sua quantidade atual
    const [itensCarrinho] = await pool.execute<RowDataPacket[] & { quantidade: number }[]>(
      `SELECT quantidade FROM ItemCarrinho WHERE idCarrinho = ? AND idProduto = ?`,
      [idCarrinho, idProduto]
    );

    if (itensCarrinho.length === 0) {
      res.status(404).json({ success: false, message: 'Produto não encontrado no carrinho.' });
      return;
    }
    const quantidadeAtual = itensCarrinho[0].quantidade;

    // 3. Lógica para remover ou atualizar a quantidade
    if (quantidadeParaRemover === undefined || quantidadeParaRemover >= quantidadeAtual) {
      // Remover o item completamente
      await pool.execute(
        `DELETE FROM ItemCarrinho WHERE idCarrinho = ? AND idProduto = ?`,
        [idCarrinho, idProduto]
      );
    } else {
      // Diminuir a quantidade
      const novaQuantidade = quantidadeAtual - quantidadeParaRemover;
      await pool.execute(
        `UPDATE ItemCarrinho SET quantidade = ? WHERE idCarrinho = ? AND idProduto = ?`,
        [novaQuantidade, idCarrinho, idProduto]
      );
    }

    // 4. Atualizar o total do carrinho
    await atualizarTotalCarrinho(idCarrinho);

    // 5. Buscar o carrinho atualizado para retornar na resposta
    const { carrinho: carrinhoAtualizado, itens: itensFormatados } = await obterDetalhesCarrinhoFormatado(idCarrinho);

    // Mesmo que o carrinhoAtualizado seja null (improvável aqui), a estrutura da resposta será mantida
    res.status(200).json({ success: true, message: 'Produto removido/atualizado do carrinho!', data: carrinhoAtualizado ? { ...carrinhoAtualizado, itens: itensFormatados } : null });

  } catch (err: any) {
    console.error("Erro ao remover produto do carrinho:", err);
    next(err);
  }
};