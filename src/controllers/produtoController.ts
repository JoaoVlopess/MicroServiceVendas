import { Request, Response, NextFunction } from 'express';
import { pool } from '../database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { ProdutoBase } from '../types/produtos/produtoBase';


// @route   GET /api/produtos
// @desc    Lista todos os produtos disponíveis
// @access  Public (ou Private, se necessitar de autenticação)


export const listarProdutos = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Substitua o mock pela lógica do banco de dados:
    const [rows] = await pool.execute<RowDataPacket[] & ProdutoBase[]>(
      `SELECT id, nome, preco, tipo, descricao FROM ProdutoBase ORDER BY nome ASC`
    );

    // Por enquanto, mantendo o mock para o código funcionar sem o BD configurado:
    res.status(200).json({ success: true, data: rows });
  } catch (err: any) {
    console.error("Erro ao buscar todos os produtos:", err);
    next(err); // Passa o erro para o próximo middleware de erro
  }
};

// @route   GET /api/produtos/:id
// @desc    Obtém um produto específico pelo seu ID
// @access  Public
export const obterProdutoPorId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params; // Pega o ID da URL

  try {
    const [rows] = await pool.execute<RowDataPacket[] & ProdutoBase[]>(
      `SELECT id, nome, preco, tipo, descricao FROM ProdutoBase WHERE id = ?`,
      [id] // Passa o ID como parâmetro para a query, prevenindo SQL Injection
    );

    const produto = rows[0]; // O resultado da query (se houver) estará na primeira posição

    if (!produto) {
      res.status(404).json({ success: false, message: 'Produto não encontrado' });
      return;
    }

    res.status(200).json({ success: true, data: produto });
  } catch (err: any) {
    console.error(`Erro ao buscar produto com ID ${id}:`, err);
    next(err);
  }
};

// @route   POST /api/produtos
// @desc    Cria um novo produto
// @access  Private (geralmente requer autenticação de admin/vendedor)
export const criarProduto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const connection = await pool.getConnection(); // Obter uma conexão para usar transação
  try {
    const { nome, preco, tipo, descricao } = req.body as ProdutoBase;

    // Validação básica
    if (!nome || typeof preco !== 'number' || preco < 0 || !tipo) {
      res.status(400).json({ success: false, message: 'Nome, tipo e um preço válido (número não negativo) são campos obrigatórios.' });
      return;
    }
    if (!['REMEDIO', 'BRINQUEDO', 'RACAO'].includes(tipo)) {
      res.status(400).json({ success: false, message: 'Tipo de produto inválido.' });
      return;
    }

    await connection.beginTransaction(); // Iniciar transação

    // Executa a query de inserção
    // O banco de dados deve gerar o ID automaticamente
    const [resultBase] = await connection.execute<ResultSetHeader>(
      `INSERT INTO ProdutoBase (nome, preco, tipo, descricao) VALUES (?, ?, ?, ?)`,
      [nome, preco, tipo, descricao]
    );

    // O 'insertId' está disponível no resultado para inserções
    const idProdutoBase = resultBase.insertId;

    // Inserir na tabela específica baseada no tipo
    switch (tipo) {
      case 'REMEDIO':
        await connection.execute(
          'INSERT INTO Remedio (id_produto_base) VALUES (?)',
          [idProdutoBase]
        );
        break;
      case 'RACAO':
        await connection.execute(
          'INSERT INTO Racao (id_produto_base) VALUES (?)',
          [idProdutoBase]
        );
        break;
      case 'BRINQUEDO':
        await connection.execute(
          'INSERT INTO Brinquedo (id_produto_base) VALUES (?)',
          [idProdutoBase]
        );
        break;
    }

    await connection.commit(); // Confirmar transação

    // Retorna o produto criado (ou apenas o ID)
    res.status(201).json({ success: true, message: `Produto do tipo ${tipo} criado com sucesso!`, data: { id: idProdutoBase, nome, preco, tipo, descricao } });

  } catch (err: any) {
    if (connection) await connection.rollback(); // Reverter transação em caso de erro
    console.error("Erro ao criar produto:", err);
    next(err); // Passa o erro para o middleware de tratamento de erros
  } finally {
    if (connection) connection.release(); // Liberar conexão de volta para o pool
  }
};

// @route   PUT /api/produtos/:id
// @desc    Atualiza um produto existente
// @access  Private (geralmente requer autenticação de admin/vendedor)
export const atualizarProduto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { nome, preco, tipo, descricao } = req.body as ProdutoBase;

    // Validação básica
    if (!nome || typeof preco !== 'number' || preco < 0 || !tipo) {
      res.status(400).json({ 
        success: false, 
        message: 'Nome, tipo e um preço válido (número não negativo) são campos obrigatórios.' 
      });
      return;
    }

    if (!['REMEDIO', 'BRINQUEDO', 'RACAO'].includes(tipo)) {
      res.status(400).json({ 
        success: false, 
        message: 'Tipo de produto inválido. Deve ser REMEDIO, BRINQUEDO ou RACAO.' 
      });
      return;
    }

    await connection.beginTransaction();

    // Verificar se o produto existe
    const [produtoExistente] = await connection.execute<RowDataPacket[] & ProdutoBase[]>(
      `SELECT id, tipo FROM ProdutoBase WHERE id = ?`,
      [id]
    );

    if (produtoExistente.length === 0) {
      res.status(404).json({ 
        success: false, 
        message: 'Produto não encontrado.' 
      });
      return;
    }

    const produtoAtual = produtoExistente[0];

    // Se o tipo mudou, precisamos atualizar as tabelas específicas
    if (produtoAtual.tipo !== tipo) {
      // Remover da tabela antiga
      switch (produtoAtual.tipo) {
        case 'REMEDIO':
          await connection.execute('DELETE FROM Remedio WHERE id_produto_base = ?', [id]);
          break;
        case 'RACAO':
          await connection.execute('DELETE FROM Racao WHERE id_produto_base = ?', [id]);
          break;
        case 'BRINQUEDO':
          await connection.execute('DELETE FROM Brinquedo WHERE id_produto_base = ?', [id]);
          break;
      }

      // Inserir na nova tabela
      switch (tipo) {
        case 'REMEDIO':
          await connection.execute('INSERT INTO Remedio (id_produto_base) VALUES (?)', [id]);
          break;
        case 'RACAO':
          await connection.execute('INSERT INTO Racao (id_produto_base) VALUES (?)', [id]);
          break;
        case 'BRINQUEDO':
          await connection.execute('INSERT INTO Brinquedo (id_produto_base) VALUES (?)', [id]);
          break;
      }
    }

    // Atualizar a tabela base
    await connection.execute(
      `UPDATE ProdutoBase 
       SET nome = ?, preco = ?, tipo = ?, descricao = ?
       WHERE id = ?`,
      [nome, preco, tipo, descricao, id]
    );

    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Produto atualizado com sucesso!',
      data: { id: parseInt(id), nome, preco, tipo, descricao }
    });

  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("Erro ao atualizar produto:", err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

// @route   DELETE /api/produtos/:id
// @desc    Remove um produto
// @access  Private (geralmente requer autenticação de admin/vendedor)
export const deletarProduto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    // Verificar se o produto existe e obter seu tipo
    const [produtoExistente] = await connection.execute<RowDataPacket[] & ProdutoBase[]>(
      `SELECT id, tipo FROM ProdutoBase WHERE id = ?`,
      [id]
    );

    if (produtoExistente.length === 0) {
      res.status(404).json({ 
        success: false, 
        message: 'Produto não encontrado.' 
      });
      return;
    }

    const produto = produtoExistente[0];

    // Remover da tabela específica primeiro
    switch (produto.tipo) {
      case 'REMEDIO':
        await connection.execute('DELETE FROM Remedio WHERE id_produto_base = ?', [id]);
        break;
      case 'RACAO':
        await connection.execute('DELETE FROM Racao WHERE id_produto_base = ?', [id]);
        break;
      case 'BRINQUEDO':
        await connection.execute('DELETE FROM Brinquedo WHERE id_produto_base = ?', [id]);
        break;
    }

    // Remover da tabela base
    await connection.execute('DELETE FROM ProdutoBase WHERE id = ?', [id]);

    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Produto removido com sucesso!'
    });

  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("Erro ao deletar produto:", err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};