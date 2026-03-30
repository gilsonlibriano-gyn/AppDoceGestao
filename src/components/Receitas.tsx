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
import { Button, Input, Card, Label } from './ui/Common';
import { ConfirmModal } from './ui/ConfirmModal';
import { formatCurrency, cn } from '../lib/utils';
import { Receita, MateriaPrima, IngredienteReceita, Configuracoes } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { supabase } from '../supabase';
import { CostService } from '../services/costService';

export function Receitas() {
  const { user } = useAuth();
  const [receitas, setReceitas] = React.useState<Receita[]>([]);
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
  const [formData, setFormData] = React.useState({
    nome: '',
    tempoPreparo: 0,
    rendimento: 1,
    ingredientes: [] as IngredienteReceita[],
    embalagens: [] as IngredienteReceita[],
    usoEnergia: [] as any[],
    usoGas: [] as any[],
    outrasDespesas: 0,
    outrasDespesasObs: '',
    lucroPretendidoPercentual: 30
  });

  React.useEffect(() => {
    if (!user) return;

    setLoading(true);

    async function fetchSettings() {
      try {
        const data = await dbService.getSingleByUid<Configuracoes>('configuracoes', user.id);
        if (data) {
          setConfig(data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    }
    fetchSettings();

    const timeout = setTimeout(() => setLoading(false), 2000);

    const unsubReceitas = dbService.subscribe<Receita>('receitas', user.id, (data) => {
      setReceitas(data);
      setLoading(false);
    });

    const unsubInsumos = dbService.subscribe<MateriaPrima>('materias_primas', user.id, (data) => {
      setInsumos(data);
    });

    return () => {
      clearTimeout(timeout);
      unsubReceitas();
      unsubInsumos();
    };
  }, [user]);

  const handleOpenModal = (receita?: Receita) => {
    console.log('Opening modal for recipe:', receita?.nome || 'New Recipe');
    if (receita) {
      setEditingReceita(receita);
      setFormData({
        nome: receita.nome,
        tempoPreparo: receita.tempoPreparo,
        rendimento: receita.rendimento,
        ingredientes: [...(receita.ingredientes || [])],
        embalagens: [...(receita.embalagens || [])],
        usoEnergia: [...(receita.usoEnergia || [])],
        usoGas: [...(receita.usoGas || [])],
        outrasDespesas: receita.outrasDespesas || 0,
        outrasDespesasObs: receita.outrasDespesasObs || '',
        lucroPretendidoPercentual: receita.lucroPretendidoPercentual || 30
      });
    } else {
      setEditingReceita(null);
      setFormData({
        nome: '',
        tempoPreparo: 0,
        rendimento: 1,
        ingredientes: [],
        embalagens: [],
        usoEnergia: [],
        usoGas: [],
        outrasDespesas: 0,
        outrasDespesasObs: '',
        lucroPretendidoPercentual: 30
      });
    }
    setIsModalOpen(true);
  };

  const handleAddIngrediente = () => {
    const availableInsumos = insumos.filter(i => (i.tipo || 'INGREDIENTE') === 'INGREDIENTE');
    if (availableInsumos.length === 0) return;
    const firstInsumo = availableInsumos[0];
    setFormData(prev => ({
      ...prev,
      ingredientes: [
        ...prev.ingredientes,
        { 
          materiaPrimaId: firstInsumo.id!, 
          quantidade: 0, 
          unidade: firstInsumo.unidadeMedida 
        }
      ]
    }));
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
          quantidade: 0, 
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
          tempoMinutos: 0 
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
          tempoMinutos: 0 
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
    setFormData(prev => {
      const newIngredientes = [...prev.ingredientes];
      newIngredientes[index] = { ...newIngredientes[index], [field]: value };
      
      if (field === 'materiaPrimaId') {
        const insumo = insumos.find(i => i.id === value);
        if (insumo) {
          newIngredientes[index].unidade = insumo.unidadeMedida;
        }
      }
      
      return { ...prev, ingredientes: newIngredientes };
    });
  };

  const handleEmbalagemChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newEmbalagens = [...prev.embalagens];
      newEmbalagens[index] = { ...newEmbalagens[index], [field]: value };
      
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
    setFormData(prev => {
      const newUso = [...prev.usoEnergia];
      newUso[index] = { ...newUso[index], [field]: value };
      
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
    setFormData(prev => {
      const newUso = [...prev.usoGas];
      newUso[index] = { ...newUso[index], [field]: value };
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
        quantidade: Number(ing.quantidade) || 0
      }));

      const sanitizedEmbalagens = formData.embalagens.map(emb => ({
        ...emb,
        quantidade: Number(emb.quantidade) || 0
      }));

      const totalCostObj = config ? CostService.calculateRecipeCost({ 
        ...formData, 
        ingredientes: sanitizedIngredientes,
        embalagens: sanitizedEmbalagens,
        usoEnergia: formData.usoEnergia.map(u => ({ ...u, tempoMinutos: Number(u.tempoMinutos) || 0 })),
        usoGas: formData.usoGas.map(u => ({ ...u, tempoMinutos: Number(u.tempoMinutos) || 0 })),
        id: 'temp', 
        uid: user.id,
        custoTotal: 0
      }, insumos, config) : { total: 0 };

      const data = {
        ...formData,
        ingredientes: sanitizedIngredientes,
        embalagens: sanitizedEmbalagens,
        usoEnergia: formData.usoEnergia.map(u => ({ ...u, tempoMinutos: Number(u.tempoMinutos) || 0 })),
        usoGas: formData.usoGas.map(u => ({ ...u, tempoMinutos: Number(u.tempoMinutos) || 0 })),
        custoTotal: totalCostObj.total,
        uid: user.id,
        updatedAt: new Date().toISOString()
      };

      if (editingReceita) {
        console.log('Receitas: Atualizando receita:', editingReceita.id);
        const result = await dbService.update('receitas', editingReceita.id!, data);
        console.log('Receitas: Receita atualizada com sucesso:', result);
      } else {
        console.log('Receitas: Criando nova receita...');
        const result = await dbService.create('receitas', {
          ...data,
          createdAt: new Date().toISOString()
        });
        console.log('Receitas: Nova receita criada com sucesso:', result);
      }
      setIsModalOpen(false);
      console.log('Receitas: Salvamento concluído.');
    } catch (error) {
      console.error('Receitas: Erro ao salvar receita:', error);
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
    return CostService.calculateRecipeCost(receita, insumos, config).total;
  };

  const filteredReceitas = receitas.filter(r => 
    r.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentRecipeCost = React.useMemo(() => {
    if (!config) return null;
    return CostService.calculateRecipeCost({
      ...formData,
      ingredientes: formData.ingredientes.map(ing => ({ ...ing, quantidade: Number(ing.quantidade) || 0 })),
      embalagens: formData.embalagens.map(emb => ({ ...emb, quantidade: Number(emb.quantidade) || 0 })),
      usoEnergia: formData.usoEnergia.map(u => ({ ...u, tempoMinutos: Number(u.tempoMinutos) || 0 })),
      usoGas: formData.usoGas.map(u => ({ ...u, tempoMinutos: Number(u.tempoMinutos) || 0 })),
      id: 'temp',
      uid: user?.id || '',
      custoTotal: 0
    }, insumos, config);
  }, [formData, insumos, config, user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Receitas</h1>
          <p className="text-neutral-500">Gerencie suas fichas técnicas e rendimentos.</p>
        </div>
        <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700" onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Receita
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input 
          placeholder="Buscar receita..." 
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p>Carregando receitas...</p>
        </div>
      ) : filteredReceitas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200">
          <ChefHat className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">Nenhuma receita encontrada.</p>
          <Button variant="ghost" className="mt-4" onClick={() => handleOpenModal()}>
            Comece criando sua primeira receita
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
                className="group cursor-pointer hover:border-orange-200 transition-all duration-300 overflow-hidden"
                onClick={() => handleOpenModal(receita)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                      <ChefHat className="w-6 h-6" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Custo Unitário</p>
                      <p className="text-lg font-bold text-neutral-900">{formatCurrency(unitCost)}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-neutral-900 mb-4">{receita.nome}</h3>
                  
                  <div className="flex items-center gap-4 text-sm text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{receita.tempoPreparo} min</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PieChart className="w-4 h-4" />
                      <span>{receita.rendimento} rend.</span>
                    </div>
                  </div>
                </div>
                
                <div 
                  className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between group-hover:bg-orange-50 transition-colors cursor-pointer"
                  onClick={() => handleOpenModal(receita)}
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
                {editingReceita ? 'Editar Receita' : 'Nova Receita'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <form id="receita-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label>Nome da Receita</Label>
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
                    onChange={(e) => setFormData({ ...formData, tempoPreparo: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rendimento (un/fatias)</Label>
                  <Input 
                    type="number" 
                    required 
                    min="1"
                    value={formData.rendimento}
                    onChange={(e) => setFormData({ ...formData, rendimento: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg">Ingredientes</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddIngrediente}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {formData.ingredientes.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl text-neutral-400">
                    <p className="text-sm">Nenhum ingrediente adicionado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.ingredientes.map((ing, index) => {
                      const insumo = insumos.find(i => i.id === ing.materiaPrimaId);
                      const unitPrice = insumo ? CostService.calculateUnitCostMP(insumo) : 0;
                      const cost = unitPrice * (Number(ing.quantidade) || 0);
                      
                      return (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-12 items-end gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div className="sm:col-span-5 space-y-2">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Ingrediente</Label>
                            <select 
                              className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              value={ing.materiaPrimaId}
                              onChange={(e) => handleIngredienteChange(index, 'materiaPrimaId', e.target.value)}
                            >
                              {insumos.filter(i => (i.tipo || 'INGREDIENTE') === 'INGREDIENTE').map(i => (
                                <option key={i.id} value={i.id}>{i.nome} ({i.unidadeMedida})</option>
                              ))}
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
                      onChange={(e) => setFormData({ ...formData, outrasDespesas: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Margem de Lucro Desejada (%)</Label>
                    <Input 
                      type="number" 
                      value={formData.lucroPretendidoPercentual}
                      onChange={(e) => setFormData({ ...formData, lucroPretendidoPercentual: Number(e.target.value) })}
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

            <div className="p-6 border-t border-neutral-100 bg-neutral-50 shrink-0">
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 p-3 bg-white rounded-lg border border-neutral-200 shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Insumos</span>
                    <span className="text-sm font-semibold text-blue-600">{currentRecipeCost ? formatCurrency(currentRecipeCost.ingredientes) : 'R$ 0,00'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Embalagens</span>
                    <span className="text-sm font-semibold text-purple-600">{currentRecipeCost ? formatCurrency(currentRecipeCost.embalagens) : 'R$ 0,00'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Mão de Obra</span>
                    <span className="text-sm font-semibold text-amber-600">{currentRecipeCost ? formatCurrency(currentRecipeCost.maoDeObra) : 'R$ 0,00'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Energia</span>
                    <span className="text-sm font-semibold text-yellow-600">{currentRecipeCost ? formatCurrency(currentRecipeCost.energia) : 'R$ 0,00'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Gás</span>
                    <span className="text-sm font-semibold text-orange-600">{currentRecipeCost ? formatCurrency(currentRecipeCost.gas) : 'R$ 0,00'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Outras</span>
                    <span className="text-sm font-semibold text-neutral-600">{currentRecipeCost ? formatCurrency(currentRecipeCost.outras) : 'R$ 0,00'}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-neutral-500 font-medium">Custo Total da Receita:</span>
                      <span className="text-2xl font-black text-indigo-600">
                        {currentRecipeCost ? formatCurrency(currentRecipeCost.total) : 'R$ 0,00'}
                      </span>
                    </div>
                    {!config && (
                      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-1">
                        <Info className="w-3 h-3" /> Configure os custos base em "Configurações" para ver o cálculo real.
                      </span>
                    )}
                    {config && currentRecipeCost && currentRecipeCost.total === 0 && formData.ingredientes.length > 0 && (
                      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-1">
                        <Info className="w-3 h-3" /> Verifique se os insumos selecionados possuem preço cadastrado.
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                    <Button type="submit" form="receita-form" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Salvar Receita
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Receita"
        message="Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
