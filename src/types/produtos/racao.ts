export type Racao = {
  id_racao: number;
  id_produto_base: number; // Chave estrangeira para ProdutoBase.id
};