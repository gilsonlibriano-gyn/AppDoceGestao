/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  MateriaPrima, 
  Receita, 
  CustoFixo, 
  Depreciacao, 
  Configuracoes,
  PricingResults,
  BreakEvenResults
} from "../types";

export class CostService {
  static calculateUnitCostMP(mp: MateriaPrima): number {
    return Number(mp.preco) || 0;
  }

  static calculateDepreciationMonthly(bem: Depreciacao): number {
    const valor = Number(bem.valor) || 0;
    const vidaUtil = Number(bem.vidaUtil) || 0;
    if (vidaUtil > 0) {
      return valor / vidaUtil;
    }
    return 0;
  }

  static calculateTotalDepreciationMonthly(bens: Depreciacao[]): number {
    return (bens || []).reduce((total, bem) => total + this.calculateDepreciationMonthly(bem), 0);
  }

  static calculateHourlyRateMOD(config: Configuracoes): number {
    const diasTrabalhadosMes = Number(config.diasTrabalhadosMes) || 0;
    const horasTrabalhadasDia = Number(config.horasTrabalhadasDia) || 0;
    const valorMensalPretendido = Number(config.valorMensalPretendido) || 0;
    
    const totalHours = diasTrabalhadosMes * horasTrabalhadasDia;
    if (totalHours > 0) {
      return valorMensalPretendido / totalHours;
    }
    return 0;
  }

  static calculateEnergyCost(potenciaW: number, tempoMinutos: number, custoKwh: number): number {
    const pW = Number(potenciaW) || 0;
    const tM = Number(tempoMinutos) || 0;
    const cK = Number(custoKwh) || 0;
    if (cK === 0) return 0;
    return (pW / 1000) * (tM / 60) * cK;
  }

  static calculateGasCost(nivel: 'BAIXO' | 'MEDIO' | 'ALTO', tempoMinutos: number, config: Configuracoes): number {
    if (!config || !config.valorBotijao) return 0;
    const valorBotijao = Number(config.valorBotijao) || 0;
    const pesoBotijao = config.tipoBotijao === 'P13' ? 13 : 45;
    const custoPorKg = valorBotijao / pesoBotijao;
    
    // Consumo kg/h conforme imagem
    const consumos = {
      BAIXO: 0.1273,
      MEDIO: 0.2182,
      ALTO: 0.2750
    };
    
    const consumoKgH = consumos[nivel] || 0;
    const custoPorHora = consumoKgH * custoPorKg;
    return (custoPorHora / 60) * (Number(tempoMinutos) || 0);
  }

  static calculateRecipeCost(receita: Receita, materiasPrimas: MateriaPrima[], config: Configuracoes): {
    ingredientes: number;
    embalagens: number;
    maoDeObra: number;
    energia: number;
    gas: number;
    outras: number;
    total: number;
  } {
    let ingredientes = 0;
    let embalagens = 0;

    (receita.ingredientes || []).forEach(item => {
      const mp = materiasPrimas.find(m => m.id === item.materiaPrimaId);
      if (mp) {
        ingredientes += this.calculateUnitCostMP(mp) * (Number(item.quantidade) || 0);
      }
    });

    (receita.embalagens || []).forEach(item => {
      const mp = materiasPrimas.find(m => m.id === item.materiaPrimaId);
      if (mp) {
        embalagens += this.calculateUnitCostMP(mp) * (Number(item.quantidade) || 0);
      }
    });

    const hourlyRateMOD = this.calculateHourlyRateMOD(config);
    const maoDeObra = ((Number(receita.tempoPreparo) || 0) / 60) * hourlyRateMOD;

    let energia = 0;
    (receita.usoEnergia || []).forEach(uso => {
      energia += this.calculateEnergyCost(uso.potenciaW, uso.tempoMinutos, config.custoKwh);
    });

    let gas = 0;
    (receita.usoGas || []).forEach(uso => {
      gas += this.calculateGasCost(uso.nivel, uso.tempoMinutos, config);
    });

    const outras = Number(receita.outrasDespesas) || 0;
    const total = ingredientes + embalagens + maoDeObra + energia + gas + outras;

    return {
      ingredientes,
      embalagens,
      maoDeObra,
      energia,
      gas,
      outras,
      total
    };
  }

  static calculateRecipeCosts(
    receita: Receita, 
    materiasPrimas: MateriaPrima[],
    config: Configuracoes,
    custosFixos: CustoFixo[],
    bens: Depreciacao[],
    targetProfitMargin: number,
    outrasDespesasVariaveis: number = 0,
    producaoMensalDesejada: number = 0
  ): PricingResults {
    const breakdown = this.calculateRecipeCost(receita, materiasPrimas, config);
    
    // Custo MP e Embalagens Unitário
    const custoMPUnitario = receita.rendimento > 0 ? breakdown.ingredientes / receita.rendimento : 0;
    const custoEmbalagemUnitario = receita.rendimento > 0 ? breakdown.embalagens / receita.rendimento : 0;

    // Custo MOD Unitário
    const custoMODUnitario = receita.rendimento > 0 ? breakdown.maoDeObra / receita.rendimento : 0;

    // Utilidades Unitário
    const custoGasUnitario = receita.rendimento > 0 ? breakdown.gas / receita.rendimento : 0;
    const custoEletricidadeUnitario = receita.rendimento > 0 ? breakdown.energia / receita.rendimento : 0;
    
    // Custo Variável Unitário (MP + Embalagem + MOD + Utilidades + Outras da receita)
    const custoVariavelUnitario = receita.rendimento > 0 ? breakdown.total / receita.rendimento : 0;

    // Custo Fixo
    let custoFixoRateadoUnitario = 0;
    const totalCF = custosFixos.reduce((total, cf) => total + cf.valor, 0);
    const totalDepreciation = this.calculateTotalDepreciationMonthly(bens);
    const totalCFWithDepreciation = totalCF + totalDepreciation;
    
    const totalHours = config.diasTrabalhadosMes * config.horasTrabalhadasDia;
    const rateCF = totalHours > 0 ? totalCFWithDepreciation / totalHours : 0;

    if (producaoMensalDesejada > 0) {
      custoFixoRateadoUnitario = totalCFWithDepreciation / producaoMensalDesejada;
    } else {
      const tempoEmHoras = receita.tempoPreparo / 60.0;
      const custoFixoLote = rateCF * tempoEmHoras;
      custoFixoRateadoUnitario = receita.rendimento > 0 ? custoFixoLote / receita.rendimento : 0;
    }

    // Custo Total (Absorção)
    const custoTotalAbsorcaoUnitario = custoVariavelUnitario + custoFixoRateadoUnitario;

    // Markup Divisor (1 - Impostos - Margem)
    const taxDecimal = (config.taxaImpostos || 0) / 100;
    const marginDecimal = targetProfitMargin / 100;
    const markupDivisor = 1.0 - (taxDecimal + marginDecimal);
    
    // Preço de Venda Sugerido (Considerando outras despesas variáveis como comissões que são fixas em valor ou %?)
    // Aqui tratamos outrasDespesasVariaveis como um valor fixo por unidade (ex: taxa de entrega)
    const precoBase = markupDivisor > 0 ? (custoTotalAbsorcaoUnitario + outrasDespesasVariaveis) / markupDivisor : 0;
    const precoVendaSugerido = precoBase;

    // Margem de Contribuição
    const impostosValor = precoVendaSugerido * taxDecimal;
    const margemContribuicaoValor = precoVendaSugerido - custoVariavelUnitario - impostosValor - outrasDespesasVariaveis;
    const margemContribuicaoPercentual = precoVendaSugerido > 0 ? (margemContribuicaoValor / precoVendaSugerido) * 100 : 0;

    return {
      custoMPUnitario,
      custoEmbalagemUnitario,
      custoMODUnitario,
      custoGasUnitario,
      custoEletricidadeUnitario,
      custoVariavelUnitario,
      custoFixoRateadoUnitario,
      custoTotalAbsorcaoUnitario,
      taxaCFHoraria: rateCF,
      markupDivisor,
      precoVendaSugerido,
      margemContribuicaoValor,
      margemContribuicaoPercentual
    };
  }

  static calculateBreakEven(
    receitaRef: Receita,
    materiasPrimas: MateriaPrima[],
    config: Configuracoes,
    custosFixos: CustoFixo[],
    bens: Depreciacao[]
  ): BreakEvenResults {
    const totalCF = custosFixos.reduce((total, cf) => total + cf.valor, 0);
    const totalDepreciation = this.calculateTotalDepreciationMonthly(bens);
    const totalCFWithDepreciation = totalCF + totalDepreciation;

    const pricing = this.calculateRecipeCosts(
      receitaRef, 
      materiasPrimas, 
      config, 
      custosFixos, 
      bens, 
      30 // margem de lucro padrão
    );

    const taxDecimal = (config.taxaImpostos || 0) / 100;
    const mcu = pricing.precoVendaSugerido - pricing.custoVariavelUnitario - (pricing.precoVendaSugerido * taxDecimal);
    const imc = pricing.precoVendaSugerido > 0 ? mcu / pricing.precoVendaSugerido : 0;
    
    const pontoEquilibrioValor = imc > 0 ? totalCFWithDepreciation / imc : 0;
    const pontoEquilibrioQuantidade = pricing.precoVendaSugerido > 0 ? pontoEquilibrioValor / pricing.precoVendaSugerido : 0;

    return {
      totalCustosFixos: totalCFWithDepreciation,
      imc,
      pontoEquilibrioValor,
      pontoEquilibrioQuantidade: Math.ceil(pontoEquilibrioQuantidade),
      receitaReferencia: receitaRef.nome,
      pvReferencia: pricing.precoVendaSugerido,
      mcuReferencia: mcu
    };
  }
}
