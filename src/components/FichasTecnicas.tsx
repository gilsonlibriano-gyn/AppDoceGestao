/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Plus, 
  Search, 
  ChefHat, 
  Clock, 
  PieChart,
  ChevronRight,
  ArrowRight,
  X,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button, Input, Card, Label, CardHeader, CardContent, Badge } from './ui/Common';
import { ConfirmModal } from './ui/ConfirmModal';
import { formatCurrency, cn, cleanNumericInput } from '../lib/utils';
import { Receita, MateriaPrima, IngredienteReceita, Configuracoes, BaseReceita } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { supabase } from '../supabase';
import { CostService } from '../services/costService';

export function FichasTecnicas() {
  const { user } = useAuth();
  const [receitas, setReceitas] = React.useState<Receita[]>([]);
  const [receitasBase, setReceitasBase] = React.useState<BaseReceita[]>([]);
  const [insumos, setInsumos] = React.useState<MateriaPrima[]>([]);
  const [config, setConfig] = React.useState<Configuracoes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingReceita, setEditingReceita] = React.useState<Receita | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState<any>({
    nome: '',
    tempoPreparo: '0',
    rendimento: '1',
    modoPreparo: '',
    ingredientes: [] as any[],
    embalagens: [] as any[],
    usoEnergia: [] as any[],
    usoGas: [] as any[],
    outrasDespesas: '0',
    outrasDespesasObs: '',
    lucroPretendidoPercentual: '30'
  });

  React.useEffect(() => {
    if (!user) return;

    setLoading(true);

    const unsubConfig = dbService.subscribe<Configuracoes>('configuracoes', user.id, (data) => {
      if (data && data.length > 0) {
        setConfig(data[0]);
      }
    });

    const timeout = setTimeout(() => setLoading(false), 2000);

    const unsubReceitas = dbService.subscribe<Receita>('receitas', user.id, (data) => {
      setReceitas(data);
      setLoading(false);
    });

    const unsubReceitasBase = dbService.subscribe<BaseReceita>('receitas_base', user.id, (data) => {
      setReceitasBase(data);
    });

    const unsubInsumos = dbService.subscribe<MateriaPrima>('materias_primas', user.id, (data) => {
      setInsumos(data);
    });

    return () => {
      clearTimeout(timeout);
      unsubConfig();
      unsubReceitas();
      unsubReceitasBase();
      unsubInsumos();
    };
  }, [user]);

  const handleOpenModal = (receita?: Receita) => {
    console.log('Opening modal for ficha técnica:', receita?.nome || 'New Ficha Técnica');
    if (receita) {
      setEditingReceita(receita);
      setFormData({
        nome: receita.nome,
        tempoPreparo: receita.tempoPreparo.toString(),
        rendimento: receita.rendimento.toString(),
        modoPreparo: receita.modoPreparo || '',
        ingredientes: (receita.ingredientes || []).map(ing => ({ ...ing, quantidade: ing.quantidade.toString() })),
        embalagens: (receita.embalagens || []).map(emb => ({ ...emb, quantidade: emb.quantidade.toString() })),
        usoEnergia: (receita.usoEnergia || []).map(u => ({ ...u, tempoMinutos: u.tempoMinutos.toString() })),
        usoGas: (receita.usoGas || []).map(u => ({ ...u, tempoMinutos: u.tempoMinutos.toString() })),
        outrasDespesas: (receita.outrasDespesas || 0).toString(),
        outrasDespesasObs: receita.outrasDespesasObs || '',
        lucroPretendidoPercentual: (receita.lucroPretendidoPercentual || config?.lucroPretendidoPercentual || 30).toString()
      });
    } else {
      setEditingReceita(null);
      setFormData({
        nome: '',
        tempoPreparo: '',
        rendimento: '',
        modoPreparo: '',
        ingredientes: [],
        embalagens: [],
        usoEnergia: [],
        usoGas: [],
        outrasDespesas: '',
        outrasDespesasObs: '',
        lucroPretendidoPercentual: (config?.lucroPretendidoPercentual || 30).toString()
      });
    }
    setIsModalOpen(true);
  };

  const handleAddIngrediente = (type: 'INSUMO' | 'RECEITA' = 'INSUMO') => {
    if (type === 'INSUMO') {
      const availableInsumos = insumos.filter(i => (i.tipo || 'INGREDIENTE') === 'INGREDIENTE');
      if (availableInsumos.length === 0) return;
      const firstInsumo = availableInsumos[0];
      setFormData(prev => ({
        ...prev,
        ingredientes: [
          ...prev.ingredientes,
          { 
            materiaPrimaId: firstInsumo.id!, 
            quantidade: '0', 
            unidade: firstInsumo.unidadeMedida 
          }
        ]
      }));
    } else {
      if (receitasBase.length === 0) return;
      const firstReceita = receitasBase[0];
      setFormData(prev => ({
        ...prev,
        ingredientes: [
          ...prev.ingredientes,
          { 
            receitaBaseId: firstReceita.id!, 
            quantidade: '0', 
            unidade: 'un' 
          }
        ]
      }));
    }
  };

  const handleAddEmbalagem = () => {
    const availableEmbalagens = insumos.filter(i => i.tipo === 'EMBALAGEM');
    if (availableEmbalagens.length === 0) return;
    const firstEmbalagem = availableEmbalagens[0];
    setFormData(prev => ({
      ...prev,
      embalagens: [
        ...prev.embalagens,
        { 
          materiaPrimaId: firstEmbalagem.id!, 
          quantidade: '0', 
          unidade: firstEmbalagem.unidadeMedida 
        }
      ]
    }));
  };

  const handleAddEnergia = () => {
    if (!config || config.equipamentos.length === 0) return;
    const firstEquip = config.equipamentos[0];
    setFormData(prev => ({
      ...prev,
      usoEnergia: [
        ...prev.usoEnergia,
        { 
          equipamentoNome: firstEquip.nome, 
          potenciaW: firstEquip.potenciaW, 
          tempoMinutos: '0' 
        }
      ]
    }));
  };

  const handleAddGas = () => {
    setFormData(prev => ({
      ...prev,
      usoGas: [
        ...prev.usoGas,
        { 
          nivel: 'MEDIO', 
          tempoMinutos: '0' 
        }
      ]
    }));
  };

  const handleRemoveIngrediente = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredientes: prev.ingredientes.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveEmbalagem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      embalagens: prev.embalagens.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveEnergia = (index: number) => {
    setFormData(prev => ({
      ...prev,
      usoEnergia: prev.usoEnergia.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveGas = (index: number) => {
    setFormData(prev => ({
      ...prev,
      usoGas: prev.usoGas.filter((_, i) => i !== index)
    }));
  };

  const handleIngredienteChange = (index: number, field: string, value: any) => {
    const cleanedValue = (field === 'quantidade') ? cleanNumericInput(value) : value;
    setFormData(prev => {
      const newIngredientes = [...prev.ingredientes];
      newIngredientes[index] = { ...newIngredientes[index], [field]: cleanedValue };
      
      if (field === 'materiaPrimaId') {
        const insumo = insumos.find(i => i.id === value);
        if (insumo) {
          newIngredientes[index].unidade = insumo.unidadeMedida;
          delete newIngredientes[index].receitaBaseId;
        }
      } else if (field === 'receitaBaseId') {
        const rb = receitasBase.find(r => r.id === value);
        if (rb) {
          newIngredientes[index].unidade = 'un'; // Default for sub-recipes
          delete newIngredientes[index].materiaPrimaId;
        }
      }
      
      return { ...prev, ingredientes: newIngredientes };
    });
  };

  const handleEmbalagemChange = (index: number, field: string, value: any) => {
    const cleanedValue = (field === 'quantidade') ? cleanNumericInput(value) : value;
    setFormData(prev => {
      const newEmbalagens = [...prev.embalagens];
      newEmbalagens[index] = { ...newEmbalagens[index], [field]: cleanedValue };
      
      if (field === 'materiaPrimaId') {
        const insumo = insumos.find(i => i.id === value);
        if (insumo) {
          newEmbalagens[index].unidade = insumo.unidadeMedida;
        }
      }
      
      return { ...prev, embalagens: newEmbalagens };
    });
  };

  const handleEnergiaChange = (index: number, field: string, value: any) => {
    const cleanedValue = (field === 'tempoMinutos') ? cleanNumericInput(value) : value;
    setFormData(prev => {
      const newUso = [...prev.usoEnergia];
      newUso[index] = { ...newUso[index], [field]: cleanedValue };
      
      if (field === 'equipamentoNome') {
        const equip = config?.equipamentos.find(e => e.nome === value);
        if (equip) {
          newUso[index].potenciaW = equip.potenciaW;
        }
      }
      
      return { ...prev, usoEnergia: newUso };
    });
  };

  const handleGasChange = (index: number, field: string, value: any) => {
    const cleanedValue = (field === 'tempoMinutos') ? cleanNumericInput(value) : value;
    setFormData(prev => {
      const newUso = [...prev.usoGas];
      newUso[index] = { ...newUso[index], [field]: cleanedValue };
      return { ...prev, usoGas: newUso };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const sanitizedIngredientes = formData.ingredientes.map(ing => ({
        ...ing,
        quantidade: parseFloat(ing.quantidade as any) || 0
      }));

      const sanitizedEmbalagens = formData.embalagens.map(emb => ({
        ...emb,
        quantidade: parseFloat(emb.quantidade as any) || 0
      }));

      const totalCostObj = config ? CostService.calculateRecipeCost({ 
        ...formData, 
        tempoPreparo: parseFloat(formData.tempoPreparo) || 0,
        rendimento: parseFloat(formData.rendimento) || 1,
        outrasDespesas: parseFloat(formData.outrasDespesas) || 0,
        lucroPretendidoPercentual: parseFloat(formData.lucroPretendidoPercentual) || 30,
        ingredientes: sanitizedIngredientes,
        embalagens: sanitizedEmbalagens,
        usoEnergia: formData.usoEnergia.map(u => ({ ...u, tempoMinutos: parseFloat(u.tempoMinutos) || 0 })),
        usoGas: formData.usoGas.map(u => ({ ...u, tempoMinutos: parseFloat(u.tempoMinutos) || 0 })),
        id: 'temp', 
        uid: user.id,
        custoTotal: 0
      }, insumos, config, receitasBase) : { total: 0 };

      const data = {
        ...formData,
        tempoPreparo: parseFloat(formData.tempoPreparo) || 0,
        rendimento: parseFloat(formData.rendimento) || 1,
        outrasDespesas: parseFloat(formData.outrasDespesas) || 0,
        lucroPretendidoPercentual: parseFloat(formData.lucroPretendidoPercentual) || 30,
        ingredientes: sanitizedIngredientes,
        embalagens: sanitizedEmbalagens,
        usoEnergia: formData.usoEnergia.map(u => ({ ...u, tempoMinutos: parseFloat(u.tempoMinutos) || 0 })),
        usoGas: formData.usoGas.map(u => ({ ...u, tempoMinutos: parseFloat(u.tempoMinutos) || 0 })),
        custoTotal: totalCostObj.total,
        uid: user.id,
        updatedAt: new Date().toISOString()
      };

      if (editingReceita) {
        console.log('Fichas Técnicas: Atualizando ficha técnica:', editingReceita.id);
        const result = await dbService.update('receitas', editingReceita.id!, data);
        console.log('Fichas Técnicas: Ficha técnica atualizada com sucesso:', result);
      } else {
        console.log('Fichas Técnicas: Criando nova ficha técnica...');
        const result = await dbService.create('receitas', {
          ...data,
          createdAt: new Date().toISOString()
        });
        console.log('Fichas Técnicas: Nova ficha técnica criada com sucesso:', result);
      }
      setIsModalOpen(false);
      console.log('Fichas Técnicas: Salvamento concluído.');
    } catch (error) {
      console.error('Fichas Técnicas: Erro ao salvar ficha técnica:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await dbService.delete('receitas', deletingId);
    } catch (error) {
      console.error('Error deleting recipe:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const calculateRecipeCostValue = (receita: Receita) => {
    if (!config) return 0;
    return CostService.calculateRecipeCost(receita, insumos, config, receitasBase).total;
  };

  const filteredReceitas = receitas.filter(r => 
    r.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentRecipeCost = React.useMemo(() => {
    if (!config) return null;
    return CostService.calculateRecipeCost({
      ...formData,
      tempoPreparo: parseFloat(formData.tempoPreparo) || 0,
      rendimento: parseFloat(formData.rendimento) || 1,
      outrasDespesas: parseFloat(formData.outrasDespesas) || 0,
      lucroPretendidoPercentual: parseFloat(formData.lucroPretendidoPercentual) || 30,
      ingredientes: formData.ingredientes.map(ing => ({ ...ing, quantidade: parseFloat(ing.quantidade as any) || 0 })),
      embalagens: formData.embalagens.map(emb => ({ ...emb, quantidade: parseFloat(emb.quantidade as any) || 0 })),
      usoEnergia: formData.usoEnergia.map(u => ({ ...u, tempoMinutos: parseFloat(u.tempoMinutos) || 0 })),
      usoGas: formData.usoGas.map(u => ({ ...u, tempoMinutos: parseFloat(u.tempoMinutos) || 0 })),
      id: 'temp',
      uid: user?.id || '',
      custoTotal: 0
    }, insumos, config, receitasBase);
  }, [formData, insumos, config, user, receitasBase]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Fichas Técnicas</h1>
          <p className="text-neutral-500">Gerencie seus produtos, custos e rendimentos.</p>
        </div>
        <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700" onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Ficha Técnica
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input 
          placeholder="Buscar ficha técnica..." 
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p>Carregando fichas técnicas...</p>
        </div>
      ) : filteredReceitas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200">
          <ChefHat className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">Nenhuma ficha técnica encontrada.</p>
          <Button variant="ghost" className="mt-4" onClick={() => handleOpenModal()}>
            Comece criando sua primeira ficha técnica
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReceitas.map((receita) => {
            const totalCost = calculateRecipeCostValue(receita);
            const unitCost = totalCost / (receita.rendimento || 1);

            return (
              <Card 
                key={receita.id} 
                className="group cursor-pointer hover:border-orange-200 transition-all duration-300 overflow-hidden flex flex-col"
                onClick={() => handleOpenModal(receita)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                      <ChefHat className="w-6 h-6" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Custo Unitário</p>
                      <p className="text-lg font-bold text-neutral-900">{formatCurrency(unitCost)}</p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <h3 className="text-lg font-bold text-neutral-900 mb-4 line-clamp-1">{receita.nome}</h3>
                  
                  <div className="flex items-center gap-4 text-sm text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-neutral-400" />
                      <span>{receita.tempoPreparo} min</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PieChart className="w-4 h-4 text-neutral-400" />
                      <span>{receita.rendimento} rend.</span>
                    </div>
                  </div>
                </CardContent>
                
                <div 
                  className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between group-hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider group-hover:text-orange-600">Ver Ficha Técnica</span>
                    <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-orange-600 transform group-hover:translate-x-1 transition-all" />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(receita.id!);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Nova/Editar Receita */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl h-[90vh] md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-neutral-900">
                {editingReceita ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <form id="receita-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label>Nome do Produto</Label>
                  <Input 
                    required 
                    placeholder="Ex: Bolo de Cenoura"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tempo de Preparo (min)</Label>
                  <Input 
                    type="number" 
                    required 
                    min="1"
                    value={formData.tempoPreparo}
                    onChange={(e) => setFormData({ ...formData, tempoPreparo: cleanNumericInput(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rendimento (un/fatias)</Label>
                  <Input 
                    type="number" 
                    required 
                    min="1"
                    value={formData.rendimento}
                    onChange={(e) => setFormData({ ...formData, rendimento: cleanNumericInput(e.target.value) })}
                  />
                </div>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-900 text-white rounded-2xl shadow-lg shadow-neutral-900/20">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Custo Total do Lote</span>
                    <span className="text-2xl font-black">{formatCurrency(currentRecipeCost?.total || 0)}</span>
                  </div>
                  <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block mb-1">Custo Unitário</span>
                    <span className="text-2xl font-black">
                      {formatCurrency((currentRecipeCost?.total || 0) / (parseFloat(formData.rendimento) || 1))}
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label>Modo de Preparo / Padronização</Label>
                  <textarea 
                    className="flex min-h-[120px] w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-all resize-none"
                    placeholder="Descreva o passo a passo para garantir a padronização do produto..."
                    value={formData.modoPreparo}
                    onChange={(e) => setFormData({ ...formData, modoPreparo: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg">Ingredientes e Receitas Base</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddIngrediente('INSUMO')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Insumo
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddIngrediente('RECEITA')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Receita Base
                    </Button>
                  </div>
                </div>

                {formData.ingredientes.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl text-neutral-400">
                    <p className="text-sm">Nenhum ingrediente ou receita adicionada.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.ingredientes.map((ing, index) => {
                      let unitPrice = 0;
                      let name = '';
                      let isReceita = !!ing.receitaBaseId;

                      if (ing.materiaPrimaId) {
                        const insumo = insumos.find(i => i.id === ing.materiaPrimaId);
                        unitPrice = insumo ? CostService.calculateUnitCostMP(insumo) : 0;
                        name = insumo?.nome || '';
                      } else if (ing.receitaBaseId) {
                        const rb = receitasBase.find(r => r.id === ing.receitaBaseId);
                        if (rb) {
                          const rbCost = CostService.calculateBaseReceitaCost(rb, insumos);
                          unitPrice = rb.rendimento > 0 ? rbCost / rb.rendimento : 0;
                          name = rb.nome;
                        }
                      }

                      const cost = unitPrice * (Number(ing.quantidade) || 0);
                      
                      return (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-12 items-end gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div className="sm:col-span-5 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">
                              {isReceita ? 'Receita Base' : 'Ingrediente'}
                            </Label>
                            <select 
                              className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              value={ing.materiaPrimaId || ing.receitaBaseId}
                              onChange={(e) => handleIngredienteChange(index, isReceita ? 'receitaBaseId' : 'materiaPrimaId', e.target.value)}
                            >
                              {isReceita ? (
                                receitasBase.map(r => (
                                  <option key={r.id} value={r.id}>{r.nome}</option>
                                ))
                              ) : (
                                insumos.filter(i => (i.tipo || 'INGREDIENTE') === 'INGREDIENTE').map(i => (
                                  <option key={i.id} value={i.id}>{i.nome} ({i.unidadeMedida})</option>
                                ))
                              )}
                            </select>
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Qtd</Label>
                            <Input 
                              type="number" 
                              step="0.001"
                              value={ing.quantidade}
                              onChange={(e) => handleIngredienteChange(index, 'quantidade', e.target.value)}
                              className="bg-white"
                            />
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Preço Unit.</Label>
                            <div className="h-10 px-3 rounded-xl border border-neutral-100 bg-neutral-100/50 flex items-center text-[10px] text-neutral-500 font-medium">
                              {formatCurrency(unitPrice)}
                            </div>
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Subtotal</Label>
                            <div className="h-10 px-3 rounded-xl border border-neutral-100 bg-neutral-100/50 flex items-center text-xs text-neutral-900 font-bold">
                              {formatCurrency(cost)}
                            </div>
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-neutral-400 hover:text-red-600"
                              onClick={() => handleRemoveIngrediente(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg">Embalagens</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddEmbalagem}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {formData.embalagens.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl text-neutral-400">
                    <p className="text-sm">Nenhuma embalagem adicionada.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.embalagens.map((emb, index) => {
                      const insumo = insumos.find(i => i.id === emb.materiaPrimaId);
                      const unitPrice = insumo ? CostService.calculateUnitCostMP(insumo) : 0;
                      const cost = unitPrice * (Number(emb.quantidade) || 0);
                      
                      return (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-12 items-end gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div className="sm:col-span-5 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Embalagem</Label>
                            <select 
                              className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              value={emb.materiaPrimaId}
                              onChange={(e) => handleEmbalagemChange(index, 'materiaPrimaId', e.target.value)}
                            >
                              {insumos.filter(i => i.tipo === 'EMBALAGEM').map(i => (
                                <option key={i.id} value={i.id}>{i.nome} ({i.unidadeMedida})</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Qtd</Label>
                            <Input 
                              type="number" 
                              step="0.001"
                              value={emb.quantidade}
                              onChange={(e) => handleEmbalagemChange(index, 'quantidade', e.target.value)}
                              className="bg-white"
                            />
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Preço Unit.</Label>
                            <div className="h-10 px-3 rounded-xl border border-neutral-100 bg-neutral-100/50 flex items-center text-[10px] text-neutral-500 font-medium">
                              {formatCurrency(unitPrice)}
                            </div>
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Subtotal</Label>
                            <div className="h-10 px-3 rounded-xl border border-neutral-100 bg-neutral-100/50 flex items-center text-xs text-neutral-900 font-bold">
                              {formatCurrency(cost)}
                            </div>
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-neutral-400 hover:text-red-600"
                              onClick={() => handleRemoveEmbalagem(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg">Energia Elétrica</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddEnergia}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {formData.usoEnergia.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl text-neutral-400">
                    <p className="text-sm">Nenhum equipamento de energia adicionado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.usoEnergia.map((uso, index) => {
                      const cost = config ? CostService.calculateEnergyCost(uso.potenciaW, Number(uso.tempoMinutos) || 0, config.custoKwh) : 0;
                      
                      return (
                        <div key={index} className="flex items-end gap-2 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div className="flex-1 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Equipamento</Label>
                            <select 
                              className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              value={uso.equipamentoNome}
                              onChange={(e) => handleEnergiaChange(index, 'equipamentoNome', e.target.value)}
                            >
                              {config?.equipamentos.map(e => (
                                <option key={e.id} value={e.nome}>{e.nome} ({e.potenciaW}W)</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-24 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Tempo (min)</Label>
                            <Input 
                              type="number" 
                              value={uso.tempoMinutos}
                              onChange={(e) => handleEnergiaChange(index, 'tempoMinutos', e.target.value)}
                              className="bg-white"
                            />
                          </div>
                          <div className="w-24 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Custo</Label>
                            <Input 
                              disabled
                              className="bg-neutral-100 font-bold text-neutral-900 h-10"
                              value={formatCurrency(cost)}
                            />
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 w-10 p-0 text-neutral-400 hover:text-red-600"
                            onClick={() => handleRemoveEnergia(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg">Gás</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddGas}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {formData.usoGas.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl text-neutral-400">
                    <p className="text-sm">Nenhum uso de gás adicionado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.usoGas.map((uso, index) => {
                      const cost = config ? CostService.calculateGasCost(uso.nivel, Number(uso.tempoMinutos) || 0, config) : 0;
                      
                      return (
                        <div key={index} className="flex items-end gap-2 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div className="flex-1 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Nível de Chama</Label>
                            <select 
                              className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              value={uso.nivel}
                              onChange={(e) => handleGasChange(index, 'nivel', e.target.value)}
                            >
                              <option value="BAIXO">Baixo</option>
                              <option value="MEDIO">Médio</option>
                              <option value="ALTO">Alto</option>
                            </select>
                          </div>
                          <div className="w-24 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Tempo (min)</Label>
                            <Input 
                              type="number" 
                              value={uso.tempoMinutos}
                              onChange={(e) => handleGasChange(index, 'tempoMinutos', e.target.value)}
                              className="bg-white"
                            />
                          </div>
                          <div className="w-24 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Custo</Label>
                            <Input 
                              disabled
                              className="bg-neutral-100 font-bold text-neutral-900 h-10"
                              value={formatCurrency(cost)}
                            />
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 w-10 p-0 text-neutral-400 hover:text-red-600"
                            onClick={() => handleRemoveGas(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label className="text-lg">Outras Despesas e Lucro</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Outras Despesas Variáveis (R$)</Label>
                    <Input 
                      type="number" 
                      value={formData.outrasDespesas}
                      onChange={(e) => setFormData({ ...formData, outrasDespesas: cleanNumericInput(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Margem de Lucro Desejada (%)</Label>
                    <Input 
                      type="number" 
                      value={formData.lucroPretendidoPercentual}
                      onChange={(e) => setFormData({ ...formData, lucroPretendidoPercentual: cleanNumericInput(e.target.value) })}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Observações de Outras Despesas</Label>
                    <Input 
                      placeholder="Ex: Taxa de entrega, comissão..."
                      value={formData.outrasDespesasObs}
                      onChange={(e) => setFormData({ ...formData, outrasDespesasObs: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between shrink-0">
              <div className="flex flex-col">
                <div className="text-sm">
                  <span className="text-neutral-500">Custo Total da Ficha Técnica: </span>
                  <span className="text-lg font-bold text-neutral-900">
                    {currentRecipeCost ? formatCurrency(currentRecipeCost.total) : 'R$ 0,00'}
                  </span>
                </div>
                {!config && (
                  <span className="text-[10px] text-amber-600 font-medium">
                    ⚠️ Configure os custos base em "Configurações" para ver o cálculo real.
                  </span>
                )}
                {config && currentRecipeCost && currentRecipeCost.total === 0 && formData.ingredientes.length > 0 && (
                  <span className="text-[10px] text-amber-600 font-medium">
                    ⚠️ Verifique se os insumos selecionados possuem preço cadastrado.
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" form="receita-form" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Ficha Técnica
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Ficha Técnica"
        message="Tem certeza que deseja excluir esta ficha técnica? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
