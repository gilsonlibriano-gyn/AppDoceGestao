/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Package,
  X,
  Loader2,
  Tag,
  Scale,
  DollarSign,
  Calculator,
  RefreshCcw,
  TrendingUp,
  Box,
  Truck,
  Info,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Save
} from 'lucide-react';
import { Button, Input, Label, Card, CardHeader, CardContent, Badge } from './ui/Common';
import { ConfirmModal } from './ui/ConfirmModal';
import { formatCurrency, cn, formatNumber, cleanNumericInput } from '../lib/utils';
import { MateriaPrima } from '../types';
import { CostService } from '../services/costService';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { supabase } from '../supabase';

export function Insumos() {
  const { user } = useAuth();
  const [insumos, setInsumos] = React.useState<MateriaPrima[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingInsumo, setEditingInsumo] = React.useState<MateriaPrima | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [activeTab, setActiveTab] = React.useState<'INGREDIENTE' | 'EMBALAGEM'>('INGREDIENTE');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc' | 'none'>('none');

  // Form State
  const [formData, setFormData] = React.useState({
    nome: '',
    categoria: 'Outros',
    unidadeMedida: 'g',
    pesoEmbalagem: '',
    valorEmbalagem: '',
    preco: '',
    fatorCorrecao: '1',
    fornecedor: '',
    tipo: 'INGREDIENTE' as 'INGREDIENTE' | 'EMBALAGEM',
    pesoUnitario: '',
    quantidadeItens: '1',
    valorUnitario: ''
  });

  // Calculate unit price automatically (cost per g/ml/un)
  React.useEffect(() => {
    const peso = parseFloat(formData.pesoEmbalagem);
    const valor = parseFloat(formData.valorEmbalagem);
    const fc = parseFloat(formData.fatorCorrecao) || 1;
    if (peso > 0 && valor >= 0) {
      const unitPrice = (valor / peso) * fc;
      setFormData(prev => ({ ...prev, preco: unitPrice.toFixed(4) }));
    }
  }, [formData.pesoEmbalagem, formData.valorEmbalagem, formData.fatorCorrecao]);

  const handleInputChange = (field: string, value: string) => {
    const cleanedValue = cleanNumericInput(value);
    setFormData(prev => {
      const newState = { ...prev, [field]: cleanedValue };
      
      // Automatic calculations based on what changed
      if (field === 'quantidadeItens' || field === 'pesoUnitario' || field === 'valorUnitario') {
        const qty = parseFloat(field === 'quantidadeItens' ? cleanedValue : prev.quantidadeItens) || 0;
        const pUnit = parseFloat(field === 'pesoUnitario' ? cleanedValue : prev.pesoUnitario) || 0;
        const vUnit = parseFloat(field === 'valorUnitario' ? cleanedValue : prev.valorUnitario) || 0;

        if (qty > 0) {
          if (field === 'quantidadeItens' || field === 'pesoUnitario') {
            const totalPeso = qty * pUnit;
            newState.pesoEmbalagem = Number(totalPeso.toFixed(3)).toString();
          }
          if (field === 'quantidadeItens' || field === 'valorUnitario') {
            const totalValor = qty * vUnit;
            newState.valorEmbalagem = totalValor.toFixed(2);
          }
        }
      } else if (field === 'pesoEmbalagem') {
        const qty = parseFloat(prev.quantidadeItens) || 0;
        const totalPeso = parseFloat(value) || 0;
        if (qty > 0) {
          newState.pesoUnitario = Number((totalPeso / qty).toFixed(3)).toString();
        }
      } else if (field === 'valorEmbalagem') {
        const qty = parseFloat(prev.quantidadeItens) || 0;
        const totalValor = parseFloat(value) || 0;
        if (qty > 0) {
          newState.valorUnitario = Number((totalValor / qty).toFixed(4)).toString();
        }
      }

      return newState;
    });
  };

  const fetchInsumos = React.useCallback(async () => {
    if (!user) return;
    try {
      const insumosData = await dbService.list<MateriaPrima>('materias_primas', user.id);
      setInsumos(insumosData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchInsumos();

    if (user) {
      const unsubInsumos = dbService.subscribe('materias_primas', user.id, () => {
        fetchInsumos();
      });
      return () => { 
        unsubInsumos(); 
      };
    }
  }, [user, fetchInsumos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    console.log('Insumos: Iniciando salvamento...', { editingInsumo, formData });
    try {
      const data: any = {
        nome: formData.nome,
        categoria: formData.categoria,
        unidadeMedida: formData.unidadeMedida,
        pesoEmbalagem: parseFloat(formData.pesoEmbalagem) || 0,
        valorEmbalagem: parseFloat(formData.valorEmbalagem) || 0,
        preco: parseFloat(formData.preco) || 0,
        fatorCorrecao: parseFloat(formData.fatorCorrecao) || 1,
        fornecedor: formData.fornecedor,
        tipo: formData.tipo,
        pesoUnitario: parseFloat(formData.pesoUnitario) || 0,
        quantidadeItens: parseFloat(formData.quantidadeItens) || 1,
        valorUnitario: parseFloat(formData.valorUnitario) || 0,
        uid: user.id
      };

      if (editingInsumo) {
        await dbService.update('materias_primas', editingInsumo.id!, data);
      } else {
        await dbService.create<MateriaPrima>('materias_primas', data);
      }

      await fetchInsumos();
      setStatusMessage({ type: 'success', text: 'Salvo com sucesso!' });
      
      // Clear message after 3 seconds
      setTimeout(() => setStatusMessage(null), 3000);
      
      setIsModalOpen(false);
      setEditingInsumo(null);
      setFormData({
        nome: '',
        categoria: 'Outros',
        unidadeMedida: activeTab === 'INGREDIENTE' ? 'g' : 'un',
        pesoEmbalagem: '',
        valorEmbalagem: '',
        preco: '0',
        fatorCorrecao: '1',
        fornecedor: '',
        tipo: activeTab,
        pesoUnitario: '',
        quantidadeItens: '1',
        valorUnitario: ''
      });
    } catch (error: any) {
      console.error('Erro ao salvar insumo:', error);
      setStatusMessage({ type: 'error', text: `Erro ao salvar: ${error.message || 'Tente novamente.'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (insumo: MateriaPrima) => {
    setEditingInsumo(insumo);
    setFormData({
      nome: insumo.nome,
      categoria: insumo.categoria || 'Outros',
      unidadeMedida: insumo.unidadeMedida,
      pesoEmbalagem: (insumo.pesoEmbalagem || 0).toString(),
      valorEmbalagem: (insumo.valorEmbalagem || 0).toString(),
      preco: insumo.preco.toString(),
      fatorCorrecao: (insumo.fatorCorrecao || 1).toString(),
      fornecedor: insumo.fornecedor || '',
      tipo: insumo.tipo || 'INGREDIENTE',
      pesoUnitario: (insumo.pesoUnitario || '').toString(),
      quantidadeItens: (insumo.quantidadeItens || 1).toString(),
      valorUnitario: (insumo.valorUnitario || '').toString()
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await dbService.delete('materias_primas', deletingId);
    } catch (error) {
      console.error('Error deleting ingredient:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredInsumos = React.useMemo(() => {
    let result = insumos.filter(i => 
      i.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (i.tipo || 'INGREDIENTE') === activeTab
    );

    if (sortOrder === 'asc') {
      result = [...result].sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (sortOrder === 'desc') {
      result = [...result].sort((a, b) => b.nome.localeCompare(a.nome));
    }

    return result;
  }, [insumos, searchTerm, activeTab, sortOrder]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Mercado</h1>
          <p className="text-neutral-500">Controle de ingredientes e embalagens</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => {
            setEditingInsumo(null);
            setFormData({
              nome: '',
              categoria: 'Outros',
              unidadeMedida: activeTab === 'INGREDIENTE' ? 'g' : 'un',
              pesoEmbalagem: '',
              valorEmbalagem: '',
              preco: '0',
              fatorCorrecao: '1',
              fornecedor: '',
              tipo: activeTab,
              pesoUnitario: '',
              quantidadeItens: '1',
              valorUnitario: ''
            });
            setIsModalOpen(true);
          }} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo {activeTab === 'INGREDIENTE' ? 'Ingrediente' : 'Embalagem'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-neutral-200">
        <button 
          onClick={() => setActiveTab('INGREDIENTE')}
          className={cn(
            "pb-4 px-2 text-sm font-bold transition-all relative",
            activeTab === 'INGREDIENTE' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          Ingredientes
          {activeTab === 'INGREDIENTE' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-in fade-in" />}
        </button>
        <button 
          onClick={() => setActiveTab('EMBALAGEM')}
          className={cn(
            "pb-4 px-2 text-sm font-bold transition-all relative",
            activeTab === 'EMBALAGEM' ? "text-indigo-600" : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          Embalagens
          {activeTab === 'EMBALAGEM' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-in fade-in" />}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input 
            placeholder={`Buscar ${activeTab === 'INGREDIENTE' ? 'ingrediente' : 'embalagem'}...`} 
            className="pl-10 bg-neutral-50 border-neutral-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? 'none' : 'asc')}
            className={cn(
              "h-10 px-4 border-neutral-200 text-neutral-600 font-medium whitespace-nowrap",
              sortOrder !== 'none' && "bg-indigo-50 border-indigo-200 text-indigo-600"
            )}
          >
            <TrendingUp className={cn("w-4 h-4 mr-2 transition-transform", sortOrder === 'desc' && "rotate-180")} />
            {sortOrder === 'none' ? 'Ordenar A-Z' : sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-medium">Carregando seus insumos...</p>
          </div>
        ) : filteredInsumos.length === 0 ? (
          <Card className="py-12 text-center">
            <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-neutral-300">
              <Package className="w-6 h-6" />
            </div>
            <p className="text-neutral-500 font-medium">Nenhum insumo encontrado.</p>
          </Card>
        ) : (
          filteredInsumos.map((insumo) => {
            const realCost = CostService.calculateUnitCostMP(insumo);
            return (
              <Card key={insumo.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-neutral-900">{insumo.nome}</h3>
                      <Badge variant="info" className="mt-1">{insumo.categoria || 'Outros'}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button onClick={() => handleEdit(insumo)} variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button onClick={() => handleDelete(insumo.id!)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-neutral-50">
                    <div>
                      <p className="text-[10px] text-neutral-400 uppercase font-bold">Custo Unit.</p>
                      <p className="font-bold text-indigo-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(realCost)}
                      </p>
                      <p className="text-[10px] text-neutral-400">por {insumo.unidadeMedida}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-400 uppercase font-bold">Fator Correção</p>
                      <p className="font-bold text-neutral-700">{insumo.fatorCorrecao || 1}x</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card className="hidden md:block overflow-hidden border-neutral-200">
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-medium">Carregando seus insumos...</p>
          </div>
        ) : filteredInsumos.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-neutral-300">
              <Package className="w-6 h-6" />
            </div>
            <p className="text-neutral-500 font-medium">Nenhum insumo encontrado.</p>
            <p className="text-sm text-neutral-400">Comece adicionando sua primeira matéria-prima.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="py-4 px-6 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Item</th>
                  <th className="py-4 px-6 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Custo Unit.</th>
                  <th className="py-4 px-6 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">FC</th>
                  <th className="py-4 px-6 text-right text-xs font-bold text-neutral-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredInsumos.map((insumo) => {
                  const realCost = CostService.calculateUnitCostMP(insumo);
                  
                  return (
                    <tr key={insumo.id} className="group hover:bg-neutral-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-neutral-900">{insumo.nome}</span>
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">{insumo.categoria || 'Outros'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-neutral-900 text-sm">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(realCost)}
                          </span>
                          <span className="text-[10px] text-neutral-400">por {insumo.unidadeMedida}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-neutral-600 text-sm">
                        {insumo.fatorCorrecao || 1}x
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button onClick={() => handleEdit(insumo)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-neutral-900 hover:bg-neutral-100">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button onClick={() => handleDelete(insumo.id!)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-lg h-[90vh] md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold">{editingInsumo ? `Editar ${activeTab === 'INGREDIENTE' ? 'Ingrediente' : 'Embalagem'}` : `Novo ${activeTab === 'INGREDIENTE' ? 'Ingrediente' : 'Embalagem'}`}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusMessage && (
              <div className={cn(
                "px-6 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2",
                statusMessage.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {statusMessage.text}
              </div>
            )}
            
            <form id="insumo-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 min-h-0">
              {/* Seção 1: Identificação */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <Tag className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Identificação</h3>
                </div>
                
                <div>
                  <Label className="flex items-center gap-1.5">Nome do Item *</Label>
                  <Input 
                    required
                    value={formData.nome}
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    placeholder={activeTab === 'INGREDIENTE' ? "Ex: Açúcar Refinado" : "Ex: Caixa para Bolo"} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-1.5">Categoria</Label>
                    <select 
                      className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={formData.categoria}
                      onChange={e => setFormData({...formData, categoria: e.target.value})}
                    >
                      {activeTab === 'INGREDIENTE' ? (
                        <>
                          <option value="Açúcares">Açúcares</option>
                          <option value="Farinhas">Farinhas</option>
                          <option value="Laticínios">Laticínios</option>
                          <option value="Gorduras">Gorduras</option>
                          <option value="Ovos">Ovos</option>
                          <option value="Chocolates">Chocolates</option>
                          <option value="Frutas">Frutas</option>
                          <option value="Outros">Outros</option>
                        </>
                      ) : (
                        <>
                          <option value="Caixas">Caixas</option>
                          <option value="Fitas">Fitas</option>
                          <option value="Adesivos">Adesivos</option>
                          <option value="Forminhas">Forminhas</option>
                          <option value="Outros">Outros</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5">Unidade de Medida *</Label>
                    <select 
                      className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={formData.unidadeMedida}
                      onChange={e => setFormData({...formData, unidadeMedida: e.target.value})}
                    >
                      {activeTab === 'INGREDIENTE' ? (
                        <>
                          <option value="g">Gramas (g)</option>
                          <option value="kg">Quilos (kg)</option>
                          <option value="ml">Mililitros (ml)</option>
                          <option value="l">Litros (l)</option>
                          <option value="un">Unidades (un)</option>
                        </>
                      ) : (
                        <>
                          <option value="un">Unidades (un)</option>
                          <option value="cm">Centímetros (cm)</option>
                          <option value="m">Metros (m)</option>
                          <option value="pct">Pacote (pct)</option>
                          <option value="cx">Caixa (cx)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 2: Custos e Embalagem */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Custos e Embalagem</h3>
                </div>

                {activeTab === 'INGREDIENTE' ? (
                  <>
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5" /> 
                          Assistente de Cálculo (Opcional)
                        </p>
                        <div className="h-px flex-1 bg-indigo-100 ml-4"></div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-neutral-600">Qtd de Itens</Label>
                          <Input 
                            type="number" 
                            value={formData.quantidadeItens}
                            onChange={e => handleInputChange('quantidadeItens', e.target.value)}
                            placeholder="Ex: 10"
                            className="h-9 text-xs bg-white border-neutral-200"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-neutral-600">Peso/Vol Unit. ({formData.unidadeMedida})</Label>
                          <Input 
                            type="number" 
                            value={formData.pesoUnitario}
                            onChange={e => handleInputChange('pesoUnitario', e.target.value)}
                            placeholder="Ex: 200"
                            className="h-9 text-xs bg-white border-neutral-200"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-neutral-600">Preço Unit. (R$)</Label>
                          <Input 
                            type="number" 
                            value={formData.valorUnitario}
                            onChange={e => handleInputChange('valorUnitario', e.target.value)}
                            placeholder="Ex: 2.89"
                            className="h-9 text-xs bg-white border-neutral-200"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-neutral-400 italic leading-relaxed">
                        Preencha os campos acima para que o sistema calcule o <strong>Peso Total</strong> e o <strong>Valor Pago</strong> automaticamente.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="flex items-center gap-1.5">Peso Total na Embalagem *</Label>
                        <Input 
                          required
                          type="number" 
                          step="0.001"
                          value={formData.pesoEmbalagem}
                          onChange={e => handleInputChange('pesoEmbalagem', e.target.value)}
                          placeholder="Ex: 1000" 
                        />
                        <p className="text-[10px] text-neutral-400 mt-1 italic">Peso total do fardo/caixa (g ou ml)</p>
                      </div>
                      <div>
                        <Label className="flex items-center gap-1.5">Valor Pago Total (R$) *</Label>
                        <Input 
                          required
                          type="number" 
                          step="0.01"
                          value={formData.valorEmbalagem}
                          onChange={e => handleInputChange('valorEmbalagem', e.target.value)}
                          placeholder="Ex: 28.90" 
                        />
                        <p className="text-[10px] text-neutral-400 mt-1 italic">Preço total pago pelo fardo/caixa</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="flex items-center gap-1.5">Peso/Medida Unitária ({formData.unidadeMedida}) *</Label>
                        <Input 
                          required
                          type="number" 
                          step="0.001"
                          value={formData.pesoUnitario}
                          onChange={e => handleInputChange('pesoUnitario', e.target.value)}
                          placeholder="Ex: 0.5" 
                        />
                        <p className="text-[10px] text-neutral-400 mt-1 italic">Ex: 0.5 kg, 0.1 cm</p>
                      </div>
                      <div>
                        <Label className="flex items-center gap-1.5">Qtd de Itens na Embalagem *</Label>
                        <Input 
                          required
                          type="number" 
                          value={formData.quantidadeItens}
                          onChange={e => handleInputChange('quantidadeItens', e.target.value)}
                          placeholder="Ex: 100" 
                        />
                        <p className="text-[10px] text-neutral-400 mt-1 italic">Ex: 100 unidades</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="flex items-center gap-1.5 opacity-70">Peso Embalagem Total (Calculado)</Label>
                        <Input 
                          readOnly
                          className="bg-neutral-50 border-neutral-200 text-neutral-500 cursor-not-allowed"
                          value={formData.pesoEmbalagem}
                          placeholder="Calculado automaticamente" 
                        />
                        <p className="text-[10px] text-neutral-400 mt-1 italic">Unitário x Quantidade</p>
                      </div>
                      <div>
                        <Label className="flex items-center gap-1.5">Valor Pago Total (R$) *</Label>
                        <Input 
                          required
                          type="number" 
                          step="0.01"
                          value={formData.valorEmbalagem}
                          onChange={e => handleInputChange('valorEmbalagem', e.target.value)}
                          placeholder="Ex: 28.90" 
                        />
                        <p className="text-[10px] text-neutral-400 mt-1 italic">Preço total pago pelo pacote</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {activeTab === 'INGREDIENTE' && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-center">
                      <Label className="text-emerald-700 flex items-center gap-1.5 font-bold mb-1">
                        <Calculator className="w-4 h-4" />
                        Custo por {formData.unidadeMedida}
                      </Label>
                      <div className="text-2xl font-black text-emerald-600 tracking-tight">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(parseFloat(formData.preco) || 0)}
                      </div>
                      <p className="text-[10px] text-emerald-600/70 mt-1 italic leading-tight">
                        Calculado: Valor Total / Peso Total
                      </p>
                    </div>
                  )}
                  {activeTab === 'EMBALAGEM' && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-center">
                      <Label className="text-emerald-700 flex items-center gap-1.5 font-bold mb-1">
                        <Calculator className="w-4 h-4" />
                        Custo por {formData.unidadeMedida}
                      </Label>
                      <div className="text-2xl font-black text-emerald-600 tracking-tight">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(parseFloat(formData.preco) || 0)}
                      </div>
                      <p className="text-[10px] text-emerald-600/70 mt-1 italic leading-tight">
                        Calculado: Valor Total / Qtd Total
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-neutral-700">
                      <RefreshCcw className="w-3 h-3" />
                      Fator de Correção (FC)
                    </Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      className="h-11"
                      value={formData.fatorCorrecao}
                      onChange={e => setFormData({...formData, fatorCorrecao: e.target.value})}
                      placeholder="Ex: 1.00" 
                    />
                    <div className="flex items-start gap-1.5 mt-1 text-neutral-500">
                      <Info className="w-3 h-3 mt-0.5 shrink-0" />
                      <p className="text-[10px] italic leading-tight">
                        {activeTab === 'INGREDIENTE' 
                          ? 'FC = Peso Bruto / Peso Líquido. Use 1 se não houver perda.' 
                          : 'Fator multiplicador para o custo final.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                    <Truck className="w-4 h-4 text-orange-500" />
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Fornecedor</h3>
                  </div>

                  <div>
                    <Label className="flex items-center gap-1.5">
                      Fornecedor Preferencial
                    </Label>
                    <Input 
                      value={formData.fornecedor}
                      onChange={e => setFormData({...formData, fornecedor: e.target.value})}
                      placeholder="Ex: Cristal Alimentos, Distribuidora X..." 
                    />
                  </div>
                </div>
            </form>

            <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3 shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" form="insumo-form" isLoading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px]">
                {editingInsumo ? 'Salvar Alterações' : `Salvar ${activeTab === 'INGREDIENTE' ? 'Ingrediente' : 'Embalagem'}`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Ingrediente"
        message="Tem certeza que deseja excluir este ingrediente? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
