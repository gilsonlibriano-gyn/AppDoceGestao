/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  TrendingUp, 
  Package, 
  ChefHat, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Loader2,
  Calculator,
  Wallet
} from 'lucide-react';
import { Card } from './ui/Common';
import { formatCurrency, cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { supabase } from '../supabase';
import { MateriaPrima, Receita, CustoFixo, BemDepreciavel, Configuracoes } from '../types';
import { CostService } from '../services/costService';

export function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({
    insumosCount: 0,
    receitasCount: 0,
    custoFixoTotal: 0,
    margemMedia: 0,
    criticalItems: [] as any[]
  });
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [config, setConfig] = React.useState<Configuracoes | null>(null);

  React.useEffect(() => {
    if (!user) return;

    const unsubConfig = dbService.subscribe<Configuracoes>('configuracoes', user.id, (data) => {
      if (data && data.length > 0) {
        setConfig(data[0]);
      }
    });

    return () => unsubConfig();
  }, [user]);

  React.useEffect(() => {
    if (!user) return;

    const state = {
      insumos: [] as MateriaPrima[],
      receitas: [] as Receita[],
      custos: [] as CustoFixo[],
      bens: [] as BemDepreciavel[]
    };

    const updateDashboard = () => {
      try {
        const totalCF = state.custos.reduce((s, c) => s + c.valor, 0);
        const totalDepr = CostService.calculateTotalDepreciationMonthly(state.bens);
        
        let totalMargem = 0;
        const chartData = state.receitas.slice(0, 6).map(r => {
          const cost = r.rendimento > 0 ? r.custoTotal / r.rendimento : 0;
          
          // Se temos config, usamos o cálculo real do service
          let price = 0;
          let margin = 0;
          if (config) {
            const pricing = CostService.calculateRecipeCosts(
              r,
              state.insumos,
              config,
              state.custos,
              state.bens,
              r.lucroPretendidoPercentual || 30,
              r.outrasDespesas || 0,
              0 // producaoMensal padrão para o dashboard
            );
            price = pricing.precoVendaSugerido;
            margin = pricing.margemContribuicaoPercentual;
          } else {
            const markup = 1 - 0.3 - 0.05;
            price = cost / markup;
            margin = 30;
          }

          totalMargem += margin;

          return {
            name: r.nome.length > 12 ? r.nome.substring(0, 10) + '...' : r.nome,
            fullName: r.nome,
            custo: Number(cost.toFixed(2)),
            preco: Number(price.toFixed(2)),
            margem: Number(margin.toFixed(1))
          };
        });

        setStats({
          insumosCount: state.insumos.length,
          receitasCount: state.receitas.length,
          custoFixoTotal: totalCF + totalDepr,
          margemMedia: state.receitas.length > 0 ? totalMargem / state.receitas.length : 0,
          criticalItems: []
        });

        setChartData(chartData.length > 0 ? chartData : [
          { name: 'Exemplo 1', custo: 10, preco: 30, margem: 30 },
          { name: 'Exemplo 2', custo: 15, preco: 45, margem: 30 }
        ]);
      } catch (err) {
        console.error("Error updating dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    // Force end loading after 2 seconds if stuck
    const timeout = setTimeout(() => setLoading(false), 2000);

    const unsubInsumos = dbService.subscribe<MateriaPrima>('materias_primas', user.id, (data) => {
      state.insumos = data;
      updateDashboard();
    });

    const unsubReceitas = dbService.subscribe<Receita>('receitas', user.id, (data) => {
      state.receitas = data;
      updateDashboard();
    });

    const unsubCustos = dbService.subscribe<CustoFixo>('custos_fixos', user.id, (data) => {
      state.custos = data;
      updateDashboard();
    });

    const unsubBens = dbService.subscribe<BemDepreciavel>('bens_depreciaveis', user.id, (data) => {
      state.bens = data;
      updateDashboard();
    });

    return () => {
      clearTimeout(timeout);
      unsubInsumos();
      unsubReceitas();
      unsubCustos();
      unsubBens();
    };
  }, [user, config]);

  const statCards = [
    { 
      label: 'Margem Média', 
      value: `${stats.margemMedia.toFixed(1)}%`, 
      icon: TrendingUp, 
      trend: stats.margemMedia > 30 ? '+ Saudável' : 'Abaixo do ideal', 
      trendUp: stats.margemMedia > 30,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    { 
      label: 'Insumos Cadastrados', 
      value: stats.insumosCount.toString(), 
      icon: Package, 
      trend: 'Ativos', 
      trendUp: true,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    { 
      label: 'Produtos Cadastrados', 
      value: stats.receitasCount.toString(), 
      icon: ChefHat, 
      trend: `${stats.receitasCount} receitas`, 
      trendUp: true,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    { 
      label: 'Custo Fixo Mensal', 
      value: formatCurrency(stats.custoFixoTotal), 
      icon: DollarSign, 
      trend: 'Base Rateio', 
      trendUp: true,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
  ];

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-neutral-400">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="font-medium text-lg">Sincronizando seus dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">Olá, {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}</h1>
        <p className="text-neutral-500">Aqui está o resumo do seu negócio hoje.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-start justify-between">
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                stat.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              )}>
                {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-neutral-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-neutral-900">Margem por Produto</h3>
              <p className="text-sm text-neutral-500">Comparativo de custo vs preço de venda</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
                <span>Preço</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-neutral-200 rounded-full" />
                <span>Custo</span>
              </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#737373', fontSize: 10 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#737373', fontSize: 10 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#fafafa' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'margem' ? `${value}%` : formatCurrency(value),
                    name === 'custo' ? 'Custo' : name === 'preco' ? 'Preço' : 'Margem'
                  ]}
                />
                <Bar dataKey="custo" fill="#e5e5e5" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="preco" fill="#f97316" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-neutral-900 mb-6">Resumo de Precificação</h3>
          <div className="space-y-6">
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <div className="flex items-center gap-3 mb-2">
                <Calculator className="w-5 h-5 text-orange-600" />
                <span className="font-bold text-neutral-900 text-sm">Meta de Lucro</span>
              </div>
              <p className="text-2xl font-black text-orange-600 tracking-tight">
                {config?.lucroPretendidoPercentual || 30}%
              </p>
              <p className="text-[10px] text-orange-600/70 mt-1 italic">
                Definido nas configurações globais.
              </p>
            </div>

            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <div className="flex items-center gap-3 mb-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-neutral-900 text-sm">Rateio de Custos</span>
              </div>
              <p className="text-sm font-medium text-neutral-600">
                O custo fixo mensal de <span className="font-bold text-neutral-900">{formatCurrency(stats.custoFixoTotal)}</span> é diluído na sua produção mensal.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-neutral-900 text-sm">Saúde Financeira</span>
              </div>
              <p className="text-sm font-medium text-neutral-600">
                {stats.margemMedia >= (config?.lucroPretendidoPercentual || 30) 
                  ? "Sua margem média está acima da meta definida. Ótimo!" 
                  : "Sua margem média está abaixo da meta. Revise seus preços."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
