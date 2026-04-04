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
  BreakEvenResults,
  BaseReceita
} from "../types";

export class CostService {
  private static parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // Handle Brazilian format with commas
      const cleaned = val.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  static calculateUnitCostMP(mp: MateriaPrima): number {
    return this.parseNumber(mp.preco);
  }

  static calculateBaseReceitaCost(receita: BaseReceita, materiasPrimas: MateriaPrima[]): number {
    let total = 0;
    const ingredientes = receita.ingredientes || [];
    
    ingredientes.forEach(item => {
      if (!item.materiaPrimaId) return;
      
      const mp = materiasPrimas.find(m => String(m.id) === String(item.materiaPrimaId));
      if (mp) {
        const unitCost = this.calculateUnitCostMP(mp);
        const quantity = this.parseNumber(item.quantidade);
        total += unitCost * quantity;
      }
    });
    return total;
  }

  static calculateDepreciationMonthly(bem: Depreciacao): number {
    const valor = this.parseNumber(bem.valor);
    const vidaUtil = this.parseNumber(bem.vidaUtil);
    if (vidaUtil > 0) {
      return valor / vidaUtil;
    }
    return 0;
  }

  static calculateTotalDepreciationMonthly(bens: Depreciacao[]): number {
    return (bens || []).reduce((total, bem) => total + this.calculateDepreciationMonthly(bem), 0);
  }

  static calculateHourlyRateMOD(config: Configuracoes | null): number {
    if (!config) return 0;
    const diasTrabalhadosMes = this.parseNumber(config.diasTrabalhadosMes);
    const horasTrabalhadasDia = this.parseNumber(config.horasTrabalhadasDia);
    const valorMensalPretendido = this.parseNumber(config.valorMensalPretendido);
    
    const totalHours = diasTrabalhadosMes * horasTrabalhadasDia;
    if (totalHours > 0) {
      return valorMensalPretendido / totalHours;
    }
    return 0;
  }

  static calculateEnergyCost(potenciaW: number, tempoMinutos: number, custoKwh: number | undefined): number {
    const pW = this.parseNumber(potenciaW);
    const tM = this.parseNumber(tempoMinutos);
    const cK = this.parseNumber(custoKwh);
    if (cK === 0) return 0;
    return (pW / 1000) * (tM / 60) * cK;
  }

  static calculateGasCost(nivel: 'BAIXO' | 'MEDIO' | 'ALTO', tempoMinutos: number, config: Configuracoes | null): number {
    if (!config || !config.valorBotijao) return 0;
    const valorBotijao = this.parseNumber(config.valorBotijao);
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
    return (custoPorHora / 60) * this.parseNumber(tempoMinutos);
  }

  static calculateRecipeCost(
    receita: Receita, 
    materiasPrimas: MateriaPrima[], 
    config: Configuracoes | null,
    receitasBase: BaseReceita[] = []
  ): {
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
      if (item.materiaPrimaId) {
        const mp = materiasPrimas.find(m => m.id === item.materiaPrimaId);
        if (mp) {
          ingredientes += this.calculateUnitCostMP(mp) * this.parseNumber(item.quantidade);
        }
      } else if (item.receitaBaseId) {
        const rb = receitasBase.find(r => r.id === item.receitaBaseId);
        if (rb) {
          const rbCost = this.calculateBaseReceitaCost(rb, materiasPrimas);
          const rendimento = this.parseNumber(rb.rendimento);
          const unitCost = rendimento > 0 ? rbCost / rendimento : 0;
          ingredientes += unitCost * this.parseNumber(item.quantidade);
        }
      }
    });

    (receita.embalagens || []).forEach(item => {
      const mp = materiasPrimas.find(m => m.id === item.materiaPrimaId);
      if (mp) {
        embalagens += this.calculateUnitCostMP(mp) * this.parseNumber(item.quantidade);
      }
    });

    const hourlyRateMOD = this.calculateHourlyRateMOD(config);
    const maoDeObra = (this.parseNumber(receita.tempoPreparo) / 60) * hourlyRateMOD;

    let energia = 0;
    (receita.usoEnergia || []).forEach(uso => {
      energia += this.calculateEnergyCost(uso.potenciaW, uso.tempoMinutos, config?.custoKwh);
    });

    let gas = 0;
    (receita.usoGas || []).forEach(uso => {
      gas += this.calculateGasCost(uso.nivel, uso.tempoMinutos, config);
    });

    const outras = this.parseNumber(receita.outrasDespesas);
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
    config: Configuracoes | null,
    custosFixos: CustoFixo[],
    bens: Depreciacao[],
    targetProfitMargin: number,
    outrasDespesasVariaveis: number = 0,
    producaoMensalDesejada: number = 0,
    receitasBase: BaseReceita[] = []
  ): PricingResults {
    const breakdown = this.calculateRecipeCost(receita, materiasPrimas, config, receitasBase);
    
    // Custo MP e Embalagens Unitário
    const rendimento = this.parseNumber(receita.rendimento) || 1;
    const custoMPUnitario = breakdown.ingredientes / rendimento;
    const custoEmbalagemUnitario = breakdown.embalagens / rendimento;

    // Custo MOD Unitário
    const custoMODUnitario = breakdown.maoDeObra / rendimento;

    // Utilidades Unitário
    const custoGasUnitario = breakdown.gas / rendimento;
    const custoEletricidadeUnitario = breakdown.energia / rendimento;
    
    // Custo Variável Unitário (MP + Embalagem + MOD + Utilidades + Outras da receita)
    const custoVariavelUnitario = breakdown.total / rendimento;

    // Custo Fixo
    let custoFixoRateadoUnitario = 0;
    const totalCF = custosFixos.reduce((total, cf) => total + this.parseNumber(cf.valor), 0);
    const totalDepreciation = this.calculateTotalDepreciationMonthly(bens);
    const totalCFWithDepreciation = totalCF + totalDepreciation;
    
    const diasTrabalhadosMes = config ? this.parseNumber(config.diasTrabalhadosMes) : 0;
    const horasTrabalhadasDia = config ? this.parseNumber(config.horasTrabalhadasDia) : 0;
    const totalHours = diasTrabalhadosMes * horasTrabalhadasDia;
    const rateCF = totalHours > 0 ? totalCFWithDepreciation / totalHours : 0;

    if (producaoMensalDesejada > 0) {
      custoFixoRateadoUnitario = totalCFWithDepreciation / producaoMensalDesejada;
    } else {
      const tempoEmHoras = this.parseNumber(receita.tempoPreparo) / 60.0;
      const custoFixoLote = rateCF * tempoEmHoras;
      custoFixoRateadoUnitario = custoFixoLote / rendimento;
    }

    // Custo Total (Absorção)
    const custoTotalAbsorcaoUnitario = custoVariavelUnitario + custoFixoRateadoUnitario;

    // Markup Divisor (1 - Impostos - Margem)
    const taxDecimal = config ? (this.parseNumber(config.taxaImpostos) / 100) : 0;
    const marginDecimal = targetProfitMargin / 100;
    const markupDivisor = 1.0 - (taxDecimal + marginDecimal);
    
    // Preço de Venda Sugerido
    const precoVendaSugerido = markupDivisor > 0 
      ? (custoTotalAbsorcaoUnitario + outrasDespesasVariaveis) / markupDivisor 
      : 0;

    // Margem de Contribuição (Preço - Custo Variável - Impostos - Outras Desp Var)
    const impostosValor = precoVendaSugerido * taxDecimal;
    const margemContribuicaoValor = precoVendaSugerido - custoVariavelUnitario - impostosValor - outrasDespesasVariaveis;
    const margemContribuicaoPercentual = precoVendaSugerido > 0 ? (margemContribuicaoValor / precoVendaSugerido) * 100 : 0;

    // Lucro Líquido Real (Preço - Custo Total Absorção - Impostos - Outras Desp Var)
    const lucroLiquidoValor = precoVendaSugerido - custoTotalAbsorcaoUnitario - impostosValor - outrasDespesasVariaveis;
    const margemLucroPercentual = precoVendaSugerido > 0 ? (lucroLiquidoValor / precoVendaSugerido) * 100 : 0;

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
      margemContribuicaoPercentual,
      lucroLiquidoValor,
      margemLucroPercentual
    };
  }

  static calculateBreakEven(
    receitaRef: Receita,
    materiasPrimas: MateriaPrima[],
    config: Configuracoes | null,
    custosFixos: CustoFixo[],
    bens: Depreciacao[],
    receitasBase: BaseReceita[] = []
  ): BreakEvenResults {
    const totalCF = custosFixos.reduce((total, cf) => total + this.parseNumber(cf.valor), 0);
    const totalDepreciation = this.calculateTotalDepreciationMonthly(bens);
    const totalCFWithDepreciation = totalCF + totalDepreciation;

    const pricing = this.calculateRecipeCosts(
      receitaRef, 
      materiasPrimas, 
      config, 
      custosFixos, 
      bens, 
      receitaRef.lucroPretendidoPercentual || config?.lucroPretendidoPercentual || 30,
      0,
      0,
      receitasBase
    );

    const taxDecimal = config ? (this.parseNumber(config.taxaImpostos) / 100) : 0;
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
