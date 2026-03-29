/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Plus, 
  Search, 
  History, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Package,
  X,
  Loader2,
  Trash2,
  Edit2,
  Coins,
  DollarSign,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle
} from 'lucide-react';
import { Button, Input, Card, Label } from './ui/Common';
import { ConfirmModal } from './ui/ConfirmModal';
import { formatNumber, cn, formatCurrency } from '../lib/utils';
import { MateriaPrima, TransacaoEstoque } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { supabase } from '../supabase';

export function Estoque() {
  const { user } = useAuth();
  const [insumos, setInsumos] = React.useState<MateriaPrima[]>([]);
  const [transacoes, setTransacoes] = React.useState<TransacaoEstoque[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = React.useState<TransacaoEstoque | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    materiaPrimaId: '',
    tipo: 'ENTRADA' as 'ENTRADA' | 'SAIDA',
    quantidade: 0,
    valor: 0,
    data: new Date().toISOString().split('T')[0],
    observacao: ''
  });

  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      const [insumosData, transacoesData] = await Promise.all([
        dbService.list<MateriaPrima>('materias_primas', user.id),
        supabase
          .from('transacoes_estoque')
          .select('*')
          .eq('uid', user.id)
          .order('data', { ascending: false })
          .limit(50)
      ]);
      
      setInsumos(insumosData);
      setTransacoes(transacoesData.data as TransacaoEstoque[] || []);
    } catch (error) {
      console.error('Erro ao carregar dados de estoque:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchData();

    if (user) {
      const unsubInsumos = dbService.subscribe('materias_primas', user.id, () => fetchData());
      const unsubTransacoes = dbService.subscribe('transacoes_estoque', user.id, () => fetchData());
      
      return () => {
        unsubInsumos();
        unsubTransacoes();
      };
    }
  }, [user, fetchData]);

  const handleOpenModal = (transaction?: TransacaoEstoque) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        materiaPrimaId: transaction.materiaPrimaId,
        tipo: transaction.tipo,
        quantidade: transaction.quantidade,
        valor: transaction.valor || 0,
        data: transaction.data,
        observacao: transaction.observacao || ''
      });
      setIsModalOpen(true);
    } else if (insumos.length > 0) {
      setEditingTransaction(null);
      setFormData({
        materiaPrimaId: insumos[0].id!,
        tipo: 'ENTRADA',
        quantidade: 0,
        valor: 0,
        data: new Date().toISOString().split('T')[0],
        observacao: ''
      });
      setIsModalOpen(true);
    } else {
      console.warn('Cadastre primeiro um insumo para registrar movimentações.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const insumo = insumos.find(i => i.id === formData.materiaPrimaId);
      if (!insumo) throw new Error('Insumo não encontrado');

      let newStock = insumo.estoqueAtual || 0;
      let newPrice = insumo.preco || 0;

      if (editingTransaction) {
        const oldInsumo = insumos.find(i => i.id === editingTransaction.materiaPrimaId);
        if (oldInsumo) {
          if (editingTransaction.tipo === 'ENTRADA') {
            newStock -= editingTransaction.quantidade;
          } else {
            newStock += editingTransaction.quantidade;
          }
        }
      }

      if (formData.tipo === 'ENTRADA') {
        const currentTotalValue = newStock * newPrice;
        const newPurchaseValue = formData.valor || (formData.quantidade * newPrice);
        newStock += formData.quantidade;
        
        if (newStock > 0) {
          newPrice = (currentTotalValue + newPurchaseValue) / newStock;
        }
      } else {
        newStock -= formData.quantidade;
      }

      if (editingTransaction) {
        await dbService.update('transacoes_estoque', editingTransaction.id!, {
          ...formData
        });
      } else {
        await dbService.create('transacoes_estoque', {
          ...formData,
          uid: user.id
        });
      }

      await dbService.update('materias_primas', insumo.id!, {
        estoqueAtual: newStock,
        preco: newPrice
      });

      setIsModalOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      console.error('Erro ao salvar movimentação:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = (t: TransacaoEstoque) => {
    setDeletingId(t.id!);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      const transaction = transacoes.find(t => t.id === deletingId);
      if (transaction) {
        const insumo = insumos.find(i => i.id === transaction.materiaPrimaId);
        if (insumo) {
          let newStock = insumo.estoqueAtual || 0;
          if (transaction.tipo === 'ENTRADA') {
            newStock -= transaction.quantidade;
          } else {
            newStock += transaction.quantidade;
          }
          
          await dbService.update('materias_primas', insumo.id!, {
            estoqueAtual: newStock
          });
        }
      }

      await dbService.delete('transacoes_estoque', deletingId);
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
    } finally {
      setDeletingId(null);
      setIsConfirmOpen(false);
    }
  };

  const [searchTermInsumos, setSearchTermInsumos] = React.useState('');
  const [searchTermHistory, setSearchTermHistory] = React.useState('');
  const [selectedInsumoId, setSelectedInsumoId] = React.useState<string | null>(null);
  const [onlyLowStock, setOnlyLowStock] = React.useState(false);

  const filteredInsumos = insumos.filter(i => {
    const matchesSearch = i.nome.toLowerCase().includes(searchTermInsumos.toLowerCase());
    const isLowStock = (i.estoqueAtual || 0) <= (i.estoqueMinimo || 0);
    return matchesSearch && (!onlyLowStock || isLowStock);
  });

  const filteredTransacoes = transacoes.filter(t => {
    const insumo = insumos.find(i => i.id === t.materiaPrimaId);
    const matchesSearch = insumo?.nome.toLowerCase().includes(searchTermHistory.toLowerCase()) ||
                         t.observacao?.toLowerCase().includes(searchTermHistory.toLowerCase());
    const matchesSelection = !selectedInsumoId || t.materiaPrimaId === selectedInsumoId;
    return matchesSearch && matchesSelection;
  });

  const totalStockValue = insumos.reduce((total, i) => total + ((i.estoqueAtual || 0) * (i.preco || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Controle de Estoque</h1>
          <p className="text-neutral-500">Acompanhe as movimentações e níveis de insumos.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Card className="px-4 py-2 flex items-center gap-3 bg-indigo-50 border-indigo-100">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Valor em Estoque</p>
              <p className="text-lg font-black text-indigo-900">{formatCurrency(totalStockValue)}</p>
            </div>
          </Card>
          <Button className="w-full sm:w-auto h-auto py-2" onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar Movimentação
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="p-6 lg:col-span-1 h-fit">
          <div className="space-y-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
                Níveis Atuais
                {insumos.some(i => (i.estoqueAtual || 0) <= (i.estoqueMinimo || 0)) && (
                  <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </h3>
              <button 
                onClick={() => setOnlyLowStock(!onlyLowStock)}
                className={cn(
                  "p-1.5 rounded-lg border transition-all",
                  onlyLowStock 
                    ? "bg-red-50 border-red-200 text-red-600" 
                    : "bg-neutral-50 border-neutral-100 text-neutral-400 hover:text-neutral-600"
                )}
                title="Filtrar estoque baixo"
              >
                <Filter className="w-3 h-3" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
              <input 
                type="text"
                placeholder="Buscar insumo..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={searchTermInsumos}
                onChange={(e) => setSearchTermInsumos(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredInsumos.length === 0 ? (
              <p className="text-sm text-neutral-400 italic">Nenhum insumo encontrado.</p>
            ) : (
              filteredInsumos.map(i => (
                <button 
                  key={i.id} 
                  onClick={() => setSelectedInsumoId(selectedInsumoId === i.id ? null : i.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
                    selectedInsumoId === i.id 
                      ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10" 
                      : "bg-neutral-50 border-neutral-100 hover:border-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-sm font-bold transition-colors",
                      selectedInsumoId === i.id ? "text-indigo-700" : "text-neutral-900"
                    )}>{i.nome}</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-neutral-500">Mín: {i.estoqueMinimo}{i.unidadeMedida}</span>
                      <span className="text-[10px] text-indigo-600 font-medium">CMP: {formatCurrency(i.preco)}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className={cn(
                      "text-sm font-black flex items-center gap-1",
                      i.estoqueAtual <= i.estoqueMinimo ? "text-red-500" : "text-emerald-600"
                    )}>
                      {i.estoqueAtual <= i.estoqueMinimo && <AlertCircle className="w-3 h-3" />}
                      {i.estoqueAtual}{i.unidadeMedida}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-medium">
                      Total: {formatCurrency(i.estoqueAtual * i.preco)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                <History className="w-5 h-5 text-orange-500" />
                Histórico Recente
              </h3>
              {selectedInsumoId && (
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 animate-in fade-in slide-in-from-left-2">
                  <span>Filtrado por: {insumos.find(i => i.id === selectedInsumoId)?.nome}</span>
                  <button onClick={() => setSelectedInsumoId(null)} className="hover:bg-indigo-200 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input 
                placeholder="Filtrar histórico..." 
                className="pl-10 h-9 text-sm"
                value={searchTermHistory}
                onChange={(e) => setSearchTermHistory(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4" />
              <p>Carregando histórico...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2">Data</th>
                    <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2">Insumo</th>
                    <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2">Tipo</th>
                    <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2 text-right">Qtd</th>
                    <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredTransacoes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-neutral-400 italic">
                        Nenhuma movimentação encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredTransacoes.map((t) => {
                      const insumo = insumos.find(i => i.id === t.materiaPrimaId);
                      return (
                        <tr key={t.id} className="group hover:bg-neutral-50 transition-colors">
                          <td className="py-4 px-2 text-sm text-neutral-500">
                            {new Date(t.data).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-neutral-100 rounded flex items-center justify-center text-neutral-400">
                                <Package className="w-3 h-3" />
                              </div>
                              <span className="font-medium text-neutral-900 text-sm">{insumo?.nome || 'Desconhecido'}</span>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <div className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              t.tipo === 'ENTRADA' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            )}>
                              {t.tipo === 'ENTRADA' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {t.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right font-bold text-sm text-neutral-900">
                            {formatNumber(t.quantidade)}
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-neutral-400 hover:text-indigo-600"
                                onClick={() => handleOpenModal(t)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600"
                                onClick={() => handleDeleteTransaction(t)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modal Registrar Movimentação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                  {formData.tipo === 'ENTRADA' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                </div>
                {editingTransaction ? 'Editar Movimentação' : 'Registrar Movimentação'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <Package className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Item e Tipo</h3>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">Insumo Selecionado</Label>
                  <select 
                    className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.materiaPrimaId}
                    onChange={(e) => setFormData({ ...formData, materiaPrimaId: e.target.value })}
                  >
                    {insumos.map(i => (
                      <option key={i.id} value={i.id}>{i.nome} ({i.unidadeMedida})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-neutral-700">Tipo de Movimentação</Label>
                    <div className="flex p-1 bg-neutral-100 rounded-xl gap-1">
                      <button 
                        type="button"
                        className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                          formData.tipo === 'ENTRADA' 
                            ? "bg-white text-emerald-600 shadow-sm" 
                            : "text-neutral-500 hover:text-neutral-700"
                        )}
                        onClick={() => setFormData({ ...formData, tipo: 'ENTRADA' })}
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        Entrada
                      </button>
                      <button 
                        type="button"
                        className={cn(
                          "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                          formData.tipo === 'SAIDA' 
                            ? "bg-white text-orange-600 shadow-sm" 
                            : "text-neutral-500 hover:text-neutral-700"
                        )}
                        onClick={() => setFormData({ ...formData, tipo: 'SAIDA' })}
                      >
                        <ArrowDownRight className="w-3 h-3" />
                        Saída
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">Quantidade</Label>
                    <Input 
                      type="number" 
                      step="0.001"
                      required 
                      className="h-11"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Detalhes Financeiros</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Data
                    </Label>
                    <Input 
                      type="date" 
                      required 
                      className="h-11"
                      value={formData.data}
                      onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3" />
                      Valor Total (R$)
                    </Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      className="h-11"
                      placeholder="0,00"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-indigo-700 italic leading-tight">
                    {formData.tipo === 'ENTRADA' 
                      ? 'O valor total da compra será usado para atualizar o Custo Médio Ponderado (CMP) do insumo automaticamente.' 
                      : 'O valor é opcional para saídas e serve apenas para controle histórico.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3" />
                  Observação
                </Label>
                <Input 
                  placeholder="Ex: Compra no mercado X, Ajuste de inventário..."
                  className="h-11"
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingTransaction ? 'Salvar Alterações' : 'Confirmar Registro'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Movimentação"
        message="Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
