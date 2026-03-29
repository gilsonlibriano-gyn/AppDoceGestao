/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Calculator, 
  ChevronRight, 
  Info,
  ArrowRight,
  Target,
  Percent,
  DollarSign,
  TrendingUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button, Input, Label, Card } from './ui/Common';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Receita, CustoFixo, Depreciacao, Configuracoes as ConfiguracoesType } from '../types';
import { CostService } from '../services/costService';

export function Precificacao() {
  const { user } = useAuth();
  const [receitas, setReceitas] = React.useState<Receita[]>([]);
  const [custosFixos, setCustosFixos] = React.useState<CustoFixo[]>([]);
  const [depreciacoes, setDepreciacoes] = React.useState<Depreciacao[]>([]);
  const [config, setConfig] = React.useState<ConfiguracoesType | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  const [selectedReceitaId, setSelectedReceitaId] = React.useState('');
  const [profitMargin, setProfitMargin] = React.useState(30);
  const [producaoMensal, setProducaoMensal] = React.useState(0);
  const [outrasDespesasVariaveis, setOutrasDespesasVariaveis] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;

    async function fetchSettings() {
      try {
        const docRef = doc(db, 'configuracoes', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data() as ConfiguracoesType);
        } else {
          // Default config if not exists
          setConfig({
            diasTrabalhadosMes: 22,
            horasTrabalhadasDia: 8,
            valorMensalPretendido: 1800,
            custoKwh: 0.91,
            equipamentos: [],
            tipoBotijao: 'P13',
            valorBotijao: 115,
            taxaImpostos: 5,
            uid: user.uid
          });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    }

    fetchSettings();

    const qReceitas = query(collection(db, 'receitas'), where('uid', '==', user.uid));
    const qCustos = query(
      collection(db, 'custos_fixos'), 
      where('uid', '==', user.uid),
      orderBy('ordem', 'asc')
    );
    const qDepr = query(collection(db, 'bens_depreciaveis'), where('uid', '==', user.uid));

    const unsubReceitas = onSnapshot(qReceitas, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Receita[];
      setReceitas(data);
      if (data.length > 0 && !selectedReceitaId) {
        setSelectedReceitaId(data[0].id!);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'receitas'));

    const unsubCustos = onSnapshot(qCustos, (snapshot) => {
      setCustosFixos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CustoFixo[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'custos_fixos'));

    const unsubDepr = onSnapshot(qDepr, (snapshot) => {
      setDepreciacoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Depreciacao[]);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bens_depreciaveis'));

    return () => {
      unsubReceitas();
      unsubCustos();
      unsubDepr();
    };
  }, [user]);

  const selectedReceita = receitas.find(r => r.id === selectedReceitaId);

  React.useEffect(() => {
    if (selectedReceita) {
      setProfitMargin(selectedReceita.lucroPretendidoPercentual || 30);
      setOutrasDespesasVariaveis(selectedReceita.outrasDespesas || 0);
    }
  }, [selectedReceitaId]);

  // Vamos buscar os insumos também para garantir precisão total no recalculo
  const [insumos, setInsumos] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!user) return;
    const qInsumos = query(collection(db, 'materias_primas'), where('uid', '==', user.uid));
    const unsubInsumos = onSnapshot(qInsumos, (snapshot) => {
      setInsumos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubInsumos();
  }, [user]);

  const pricingFull = selectedReceita && config ? CostService.calculateRecipeCosts(
    selectedReceita,
    insumos,
    config,
    custosFixos,
    depreciacoes,
    profitMargin,
    outrasDespesasVariaveis,
    producaoMensal
  ) : null;

  if (loading || !config) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p>Carregando dados para precificação...</p>
      </div>
    );
  }

  if (receitas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Nenhuma receita encontrada</h2>
        <p className="text-neutral-500 max-w-md">
          Você precisa cadastrar pelo menos uma receita para poder calcular o preço de venda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">Precificação</h1>
        <p className="text-neutral-500">Calcule o preço de venda ideal com base nos seus custos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6">
            <h3 className="font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              Parâmetros
            </h3>
            
            <div className="space-y-6">
              <div>
                <Label>Produto de Referência</Label>
                <select 
                  className="flex h-11 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-all"
                  value={selectedReceitaId}
                  onChange={(e) => setSelectedReceitaId(e.target.value)}
                >
                  {receitas.map(r => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Produção Mensal (un)</Label>
                  <Input 
                    type="number" 
                    value={producaoMensal}
                    onChange={(e) => setProducaoMensal(Number(e.target.value))}
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">Rateio custos fixos pelo volume</p>
                </div>
                <div>
                  <Label>Outras Desp. Var. (R$)</Label>
                  <Input 
                    type="number" 
                    value={outrasDespesasVariaveis}
                    onChange={(e) => setOutrasDespesasVariaveis(Number(e.target.value))}
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">Comissões ou taxas por unidade</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Horas Disponíveis/Mês</Label>
                  <Input 
                    type="number" 
                    disabled
                    value={config.diasTrabalhadosMes * config.horasTrabalhadasDia}
                    className="bg-neutral-50"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">Definido nas configurações</p>
                </div>
                <div>
                  <Label>Impostos/Taxas (%)</Label>
                  <Input 
                    type="number" 
                    disabled
                    value={config.taxaImpostos}
                    className="bg-neutral-50"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">Definido nas configurações</p>
                </div>
              </div>

              <div>
                <Label className="flex items-center justify-between">
                  Margem de Lucro Desejada
                  <span className="text-indigo-600 font-bold">{profitMargin}%</span>
                </Label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(parseInt(e.target.value))}
                  className="w-full h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-2 font-bold uppercase tracking-wider">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-indigo-600 text-white border-none shadow-xl shadow-indigo-600/20">
            <p className="text-indigo-100 text-sm font-medium">Preço de Venda Sugerido</p>
            <h2 className="text-4xl font-black mt-2">{formatCurrency(pricingFull?.precoVendaSugerido || 0)}</h2>
            <div className="mt-6 pt-6 border-t border-white/20 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-indigo-100 text-xs uppercase font-bold tracking-wider">Margem de Contribuição</span>
                <span className="text-xl font-bold">{formatPercent(pricingFull?.margemContribuicaoPercentual || 0)}</span>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="font-bold text-neutral-900 mb-6">Composição do Custo (Unitário)</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 rounded-full bg-indigo-500" />
                  <span className="text-sm font-medium text-neutral-700">Ingredientes</span>
                </div>
                <span className="font-bold text-neutral-900">{formatCurrency(pricingFull?.custoMPUnitario || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 rounded-full bg-pink-500" />
                  <span className="text-sm font-medium text-neutral-700">Embalagens</span>
                </div>
                <span className="font-bold text-neutral-900">{formatCurrency(pricingFull?.custoEmbalagemUnitario || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium text-neutral-700">Mão de Obra Direta</span>
                </div>
                <span className="font-bold text-neutral-900">{formatCurrency(pricingFull?.custoMODUnitario || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium text-neutral-700">Energia Elétrica</span>
                </div>
                <span className="font-bold text-neutral-900">{formatCurrency(pricingFull?.custoEletricidadeUnitario || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 rounded-full bg-orange-500" />
                  <span className="text-sm font-medium text-neutral-700">Gás</span>
                </div>
                <span className="font-bold text-neutral-900">{formatCurrency(pricingFull?.custoGasUnitario || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 rounded-full bg-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700">Custos Fixos Rateados</span>
                </div>
                <span className="font-bold text-neutral-900">{formatCurrency(pricingFull?.custoFixoRateadoUnitario || 0)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-neutral-700">Outras Despesas</span>
                </div>
                <span className="font-bold text-neutral-900">{formatCurrency(outrasDespesasVariaveis)}</span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-900 text-white mt-4 shadow-lg shadow-neutral-900/20">
                <span className="font-bold">Custo Total por Absorção</span>
                <span className="text-lg font-bold">{formatCurrency(pricingFull?.custoTotalAbsorcaoUnitario || 0)}</span>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 text-neutral-500 mb-2">
                <Percent className="w-4 h-4" />
                <span className="text-sm font-medium">Mark-up Divisor</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900">{pricingFull?.markupDivisor.toFixed(4) || '0.0000'}</p>
              <p className="text-xs text-neutral-400 mt-1">Fator multiplicador de venda</p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-2 text-neutral-500 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Custo Fixo Unitário</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(pricingFull?.custoFixoRateadoUnitario || 0)}</p>
              <p className="text-xs text-neutral-400 mt-1">Baseado nos custos fixos e depreciação</p>
            </Card>
          </div>

          <Card className="p-6 bg-blue-50 border-blue-100">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-bold text-blue-900 text-sm">Margem vs. Markup</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  O sistema utiliza a <strong>Margem sobre o Preço de Venda</strong>. 
                  Diferente do Markup (que apenas adiciona uma porcentagem ao custo), a Margem garante que a porcentagem de lucro seja calculada sobre o valor final recebido, cobrindo impostos e custos de forma segura.
                </p>
                <div className="pt-2 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Cálculo Atual:</span>
                  <code className="text-[11px] bg-white/50 p-1 rounded border border-blue-200 block">
                    Preço = Custo Total / (1 - {profitMargin}% - {config.taxaImpostos}%)
                  </code>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
