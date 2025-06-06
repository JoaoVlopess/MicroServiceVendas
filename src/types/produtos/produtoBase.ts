export type ProdutoBase = {
  id: number;
  nome: string;
  preco: number;
  descricao?: string;
  tipo: 'REMEDIO' | 'BRINQUEDO' | 'RACAO';
};