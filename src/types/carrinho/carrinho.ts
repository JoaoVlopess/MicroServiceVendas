import { ItemCarrinho } from "./itemCarrinho";

export type Carrinho = {
  idUsuario: number; 
  itens: ItemCarrinho[];    
  dataCriacao?: Date;         
  dataUltimaModificacao?: Date;
  idCarrinho?: number;
  total?: number; 
};