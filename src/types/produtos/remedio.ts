export type Remedio = {
  id_remedio: number;
  id_produto_base: number; // Chave estrangeira para ProdutoBase.id
};