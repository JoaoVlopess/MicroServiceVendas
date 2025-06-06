type Carrinho = {
  idUsuario: number; // ID do usuário proprietário do carrinho
  itens: ItemCarrinho[];      // Lista de itens no carrinho
  dataCriacao?: Date;         // Opcional: quando o carrinho foi criado
  dataUltimaModificacao?: Date; // Opcional: quando foi modificado pela última vez
  idCarrinho?: number;
  total?: number; 
};