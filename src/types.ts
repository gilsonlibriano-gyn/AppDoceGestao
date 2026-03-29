/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MateriaPrima {
  id?: string;
  nome: string;
  categoria: string;
  unidadeMedida: string;
  pesoEmbalagem: number;
  valorEmbalagem: number;
  preco: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  fatorCorrecao: number;
  fornecedor: string;
  tipo: 'INGREDIENTE' | 'EMBALAGEM';
  pesoUnitario?: number;
  quantidadeItens?: number;
  valorUnitario?: number;
  uid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface IngredienteReceita {
  materiaPrimaId: string;
  quantidade: number;
  unidade: string;
}

export interface EquipamentoUso {
  equipamentoNome: string;
  potenciaW: number;
  tempoMinutos: number;
}

export interface GasUso {
  nivel: 'BAIXO' | 'MEDIO' | 'ALTO';
  tempoMinutos: number;
}

export interface Receita {
  id?: string;
  nome: string;
  tempoPreparo: number;
  rendimento: number;
  ingredientes: IngredienteReceita[];
  embalagens: IngredienteReceita[];
  usoEnergia: EquipamentoUso[];
  usoGas: GasUso[];
  outrasDespesas: number;
  outrasDespesasObs: string;
  lucroPretendidoPercentual: number;
  custoTotal: number;
  uid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CustoFixo {
  id?: string;
  nome: string;
  valor: number;
  ordem?: number;
  uid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Depreciacao {
  id?: string;
  nome: string;
  valor: number;
  vidaUtil: number;
  dataCompra: string;
  categoria?: string;
  taxaAnual?: number;
  uid: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface TransacaoEstoque {
  id?: string;
  materiaPrimaId: string;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  valor?: number;
  data: string;
  observacao?: string;
  uid: string;
  createdAt?: any;
}

export interface BemDepreciavel extends Depreciacao {}

export interface EquipamentoConfig {
  id: string;
  nome: string;
  potenciaW: number;
}

export interface Configuracoes {
  id?: string;
  // Mão de obra
  diasTrabalhadosMes: number;
  horasTrabalhadasDia: number;
  valorMensalPretendido: number;
  
  // Energia
  custoKwh: number;
  equipamentos: EquipamentoConfig[];
  
  // Gás
  tipoBotijao: 'P13' | 'P45';
  valorBotijao: number;
  
  // Outros
  taxaImpostos: number;
  uid: string;
}

export interface PricingResults {
  custoMPUnitario: number;
  custoEmbalagemUnitario: number;
  custoMODUnitario: number;
  custoGasUnitario: number;
  custoEletricidadeUnitario: number;
  custoVariavelUnitario: number;
  custoFixoRateadoUnitario: number;
  custoTotalAbsorcaoUnitario: number;
  taxaCFHoraria: number;
  markupDivisor: number;
  precoVendaSugerido: number;
  margemContribuicaoValor: number;
  margemContribuicaoPercentual: number;
}

export interface BreakEvenResults {
  totalCustosFixos: number;
  imc: number;
  pontoEquilibrioValor: number;
  pontoEquilibrioQuantidade: number;
  receitaReferencia: string;
  pvReferencia: number;
  mcuReferencia: number;
}
