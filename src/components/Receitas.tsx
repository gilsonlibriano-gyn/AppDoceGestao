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
import { BaseReceita, MateriaPrima, Configuracoes } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { supabase } from '../supabase';
import { CostService } from '../services/costService';

export function Receitas() {
  const { user } = useAuth();
  const [receitas, setReceitas] = React.useState<BaseReceita[]>([]);
  const [insumos, setInsumos] = React.useState<MateriaPrima[]>([]);
  const [config, setConfig] = React.useState<Configuracoes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingReceita, setEditingReceita] = React.useState<BaseReceita | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form state
  const [formData, setFormData] = React.useState<any>({
    nome: '',
    rendimento: '1',
    modoPreparo: '',
    ingredientes: [] as any[]
  });

  React.useEffect(() => {
    if (!user) return;

    setLoading(true);

    const unsubConfig = dbService.subscribe<Configuracoes>('configuracoes', user.id, (data) => {
      if (data && data.length > 0) {
        setConfig(data[0]);
      }
    });

    const unsubReceitas = dbService.subscribe<BaseReceita>('receitas_base', user.id, (data) => {
      setReceitas(data);
      setLoading(false);
    });

    const unsubInsumos = dbService.subscribe<MateriaPrima>('materias_primas', user.id, (data) => {
      setInsumos(data);
    });

    return () => {
      unsubConfig();
      unsubReceitas();
      unsubInsumos();
    };
  }, [user]);

  const handleOpenModal = (receita?: BaseReceita) => {
    if (receita) {
      setEditingReceita(receita);
      setFormData({
        nome: receita.nome,
        rendimento: receita.rendimento.toString(),
        modoPreparo: receita.modoPreparo || '',
        ingredientes: (receita.ingredientes || []).map(ing => ({ ...ing, quantidade: ing.quantidade.toString() }))
      });
    } else {
      setEditingReceita(null);
      setFormData({
        nome: '',
        rendimento: '1',
        modoPreparo: '',
        ingredientes: []
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
          quantidade: '0', 
          unidade: firstInsumo.unidadeMedida 
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

  const handleIngredienteChange = (index: number, field: string, value: any) => {
    const cleanedValue = (field === 'quantidade') ? cleanNumericInput(value) : value;
    setFormData(prev => {
      const newIngredientes = [...prev.ingredientes];
      newIngredientes[index] = { ...newIngredientes[index], [field]: cleanedValue };
      
      if (field === 'materiaPrimaId') {
        const insumo = insumos.find(i => i.id === value);
        if (insumo) {
          newIngredientes[index].unidade = insumo.unidadeMedida;
        }
      }
      
      return { ...prev, ingredientes: newIngredientes };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const sanitizedIngredientes = formData.ingredientes.map(ing => ({
        ...ing,
        quantidade: parseFloat(ing.quantidade as any) || 0
      }));

      const data = {
        ...formData,
        rendimento: parseFloat(formData.rendimento) || 1,
        ingredientes: sanitizedIngredientes,
        uid: user.id,
        updatedAt: new Date().toISOString()
      };

      if (editingReceita) {
        await dbService.update('receitas_base', editingReceita.id!, data);
      } else {
        await dbService.create('receitas_base', {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      
      setStatusMessage({ type: 'success', text: 'Receita salva com sucesso!' });
      setTimeout(() => setStatusMessage(null), 3000);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar receita:', error);
      setStatusMessage({ type: 'error', text: `Erro ao salvar: ${error.message || 'Tente novamente.'}` });
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
      await dbService.delete('receitas_base', deletingId);
    } catch (error) {
      console.error('Error deleting recipe:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredReceitas = receitas.filter(r => 
    r.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentRecipeCost = React.useMemo(() => {
    if (!isModalOpen) return 0;
    const tempReceita: BaseReceita = {
      ...formData,
      rendimento: parseFloat(formData.rendimento) || 1,
      ingredientes: formData.ingredientes.map((ing: any) => ({
        ...ing,
        quantidade: parseFloat(ing.quantidade) || 0
      })),
      id: 'temp',
      uid: user?.id || '',
      createdAt: '',
      updatedAt: ''
    };
    return CostService.calculateBaseReceitaCost(tempReceita, insumos);
  }, [formData, insumos, isModalOpen, user?.id]);

  const unitCost = React.useMemo(() => {
    const rendimento = parseFloat(formData.rendimento) || 1;
    return rendimento > 0 ? currentRecipeCost / rendimento : 0;
  }, [currentRecipeCost, formData.rendimento]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Receitas</h1>
          <p className="text-neutral-500">Cadastre o modo de preparo e ingredientes base.</p>
        </div>
        <Button className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700" onClick={() => handleOpenModal()}>
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
          {filteredReceitas.map((receita) => (
            <Card 
              key={receita.id} 
              className="group cursor-pointer hover:border-orange-200 transition-all duration-300 overflow-hidden flex flex-col"
              onClick={() => handleOpenModal(receita)}
            >
              <CardHeader className="pb-2">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                  <ChefHat className="w-6 h-6" />
                </div>
              </CardHeader>
              
              <CardContent className="flex-1">
                <h3 className="text-lg font-bold text-neutral-900 mb-4 line-clamp-1">{receita.nome}</h3>
                <div className="flex items-center gap-4 text-sm text-neutral-500 mb-4">
                  <div className="flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-neutral-400" />
                    <span>Rendimento: {receita.rendimento}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-50">
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase font-bold">Custo Total</p>
                    <p className="font-bold text-orange-600">
                      {formatCurrency(CostService.calculateBaseReceitaCost(receita, insumos))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase font-bold">Custo Unit.</p>
                    <p className="font-bold text-neutral-700">
                      {formatCurrency(CostService.calculateBaseReceitaCost(receita, insumos) / (parseFloat(receita.rendimento as any) || 1))}
                    </p>
                  </div>
                </div>
              </CardContent>
              
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between group-hover:bg-orange-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider group-hover:text-orange-600">Editar Receita</span>
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
          ))}
        </div>
      )}

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

            {statusMessage && (
              <div className={cn(
                "px-6 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2",
                statusMessage.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {statusMessage.text}
              </div>
            )}
            
            <form id="receita-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label>Nome da Receita</Label>
                  <Input 
                    required 
                    placeholder="Ex: Massa de Bolo de Chocolate"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Rendimento (un/kg/fatias)</Label>
                  <Input 
                    type="number" 
                    required 
                    min="0.001"
                    step="0.001"
                    value={formData.rendimento}
                    onChange={(e) => setFormData({ ...formData, rendimento: cleanNumericInput(e.target.value) })}
                  />
                </div>
                
                <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Custo Total</span>
                    <span className="text-lg font-bold text-neutral-900">{formatCurrency(currentRecipeCost)}</span>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Custo Unitário</span>
                    <span className="text-lg font-bold text-indigo-600">{formatCurrency(unitCost)}</span>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label>Modo de Preparo</Label>
                  <textarea 
                    className="flex min-h-[120px] w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-all resize-none"
                    placeholder="Descreva o passo a passo da receita..."
                    value={formData.modoPreparo}
                    onChange={(e) => setFormData({ ...formData, modoPreparo: e.target.value })}
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
                    {formData.ingredientes.map((ing, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-12 items-end gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                        <div className="sm:col-span-7 space-y-2">
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
                        <div className="sm:col-span-4 space-y-2">
                          <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Quantidade</Label>
                          <Input 
                            type="number" 
                            step="0.001"
                            value={ing.quantidade}
                            onChange={(e) => handleIngredienteChange(index, 'quantidade', e.target.value)}
                            className="bg-white"
                          />
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
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3 shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" form="receita-form" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar Receita
              </Button>
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
