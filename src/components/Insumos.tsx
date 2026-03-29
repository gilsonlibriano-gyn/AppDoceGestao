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
  AlertCircle,
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
  ArrowDownRight
} from 'lucide-react';
import { Button, Input, Label, Card } from './ui/Common';
import { ConfirmModal } from './ui/ConfirmModal';
import { formatCurrency, cn, formatNumber } from '../lib/utils';
import { MateriaPrima, TransacaoEstoque } from '../types';
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
  const [transacoes, setTransacoes] = React.useState<TransacaoEstoque[]>([]);
  const [selectedInsumoId, setSelectedInsumoId] = React.useState<string | null>(null);
  const [searchTermHistory, setSearchTermHistory] = React.useState('');

  const [activeTab, setActiveTab] = React.useState<'INGREDIENTE' | 'EMBALAGEM'>('INGREDIENTE');

  // Form State
  const [formData, setFormData] = React.useState({
    nome: '',
    categoria: 'Outros',
    unidadeMedida: 'g',
    pesoEmbalagem: '',
    valorEmbalagem: '',
    preco: '0',
    estoqueAtual: '0',
    estoqueMinimo: '0',
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
    setFormData(prev => {
      const newState = { ...prev, [field]: value };
      
      // Automatic calculations based on what changed
      if (field === 'quantidadeItens' || field === 'pesoUnitario' || field === 'valorUnitario') {
        const qty = parseFloat(field === 'quantidadeItens' ? value : prev.quantidadeItens) || 0;
        const pUnit = parseFloat(field === 'pesoUnitario' ? value : prev.pesoUnitario) || 0;
        const vUnit = parseFloat(field === 'valorUnitario' ? value : prev.valorUnitario) || 0;

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
      const [insumosData, transacoesData] = await Promise.all([
        dbService.list<MateriaPrima>('materias_primas', user.id),
        dbService.list<TransacaoEstoque>('transacoes_estoque', user.id)
      ]);
      setInsumos(insumosData);
      setTransacoes(transacoesData.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()));
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
      const unsubTransacoes = dbService.subscribe('transacoes_estoque', user.id, () => {
        fetchInsumos();
      });
      return () => { 
        unsubInsumos(); 
        unsubTransacoes();
      };
    }
  }, [user, fetchInsumos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    console.log('Insumos: Iniciando salvamento...', { editingInsumo, formData });
    try {
      const estoqueAtualNum = parseFloat(formData.estoqueAtual) || 0;
      const data: any = {
        nome: formData.nome,
        categoria: formData.categoria,
        unidadeMedida: formData.unidadeMedida,
        pesoEmbalagem: parseFloat(formData.pesoEmbalagem) || 0,
        valorEmbalagem: parseFloat(formData.valorEmbalagem) || 0,
        preco: parseFloat(formData.preco) || 0,
        estoqueMinimo: parseFloat(formData.estoqueMinimo) || 0,
        fatorCorrecao: parseFloat(formData.fatorCorrecao) || 1,
        fornecedor: formData.fornecedor,
        tipo: formData.tipo,
        pesoUnitario: parseFloat(formData.pesoUnitario) || 0,
        quantidadeItens: parseFloat(formData.quantidadeItens) || 1,
        valorUnitario: parseFloat(formData.valorUnitario) || 0,
        uid: user.id
      };

      if (editingInsumo) {
        console.log('Insumos: Atualizando item existente (modo edição):', editingInsumo.id);
        const result = await dbService.update('materias_primas', editingInsumo.id!, data);
        console.log('Insumos: Item atualizado com sucesso:', result);
      } else {
        const existing = insumos.find(i => 
          i.nome.toLowerCase().trim() === formData.nome.toLowerCase().trim() && 
          (i.tipo || 'INGREDIENTE') === formData.tipo
        );

        if (existing) {
          console.log('Insumos: Item já existe, atualizando estoque e preço:', existing.id);
          const currentStock = existing.estoqueAtual || 0;
          const currentPrice = existing.preco || 0;
          const newQuantity = estoqueAtualNum;
          const newUnitPrice = data.preco;

          let updatedStock = currentStock;
          let updatedPrice = currentPrice;

          if (newQuantity > 0) {
            const currentTotalValue = currentStock * currentPrice;
            const newTotalValue = newQuantity * newUnitPrice;
            updatedStock = currentStock + newQuantity;
            updatedPrice = (currentTotalValue + newTotalValue) / updatedStock;
          }

          const result = await dbService.update('materias_primas', existing.id!, {
            ...data,
            estoqueAtual: updatedStock,
            preco: updatedPrice
          });
          console.log('Insumos: Item existente atualizado com sucesso:', result);

          if (newQuantity > 0) {
            console.log('Insumos: Registrando transação de estoque para item existente...');
            await dbService.create('transacoes_estoque', {
              materiaPrimaId: existing.id,
              tipo: 'ENTRADA',
              quantidade: newQuantity,
              valor: newQuantity * newUnitPrice,
              data: new Date().toISOString().split('T')[0],
              observacao: 'Atualização via cadastro (item existente)',
              uid: user.id
            });
          }
        } else {
          console.log('Insumos: Criando novo insumo...');
          const created = await dbService.create<MateriaPrima>('materias_primas', {
            ...data,
            estoqueAtual: estoqueAtualNum
          });
          console.log('Insumos: Novo insumo criado com sucesso:', created);

          if (estoqueAtualNum > 0) {
            console.log('Insumos: Registrando transação de estoque inicial...');
            await dbService.create('transacoes_estoque', {
              materiaPrimaId: created.id,
              tipo: 'ENTRADA',
              quantidade: estoqueAtualNum,
              valor: estoqueAtualNum * data.preco,
              data: new Date().toISOString().split('T')[0],
              observacao: 'Saldo inicial no cadastro',
              uid: user.id
            });
          }
        }
      }

      console.log('Save successful, fetching updated list');
      await fetchInsumos();
      setIsModalOpen(false);
      setEditingInsumo(null);
      setFormData({
        nome: '',
        categoria: 'Outros',
        unidadeMedida: activeTab === 'INGREDIENTE' ? 'g' : 'un',
        pesoEmbalagem: '',
        valorEmbalagem: '',
        preco: '0',
        estoqueAtual: '0',
        estoqueMinimo: '0',
        fatorCorrecao: '1',
        fornecedor: '',
        tipo: activeTab,
        pesoUnitario: '',
        quantidadeItens: '1',
        valorUnitario: ''
      });
    } catch (error) {
      console.error('Erro ao salvar insumo:', error);
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
      estoqueAtual: insumo.estoqueAtual.toString(),
      estoqueMinimo: insumo.estoqueMinimo.toString(),
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

  const filteredInsumos = insumos.filter(i => 
    i.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (i.tipo || 'INGREDIENTE') === activeTab
  );

  const filteredTransacoes = transacoes.filter(t => {
    const insumo = insumos.find(i => i.id === t.materiaPrimaId);
    const matchesSearch = insumo?.nome.toLowerCase().includes(searchTermHistory.toLowerCase()) || 
                         t.observacao?.toLowerCase().includes(searchTermHistory.toLowerCase());
    const matchesSelected = !selectedInsumoId || t.materiaPrimaId === selectedInsumoId;
    return matchesSearch && matchesSelected;
  }).slice(0, 10); // Show only last 10 in Insumos module

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Mercado</h1>
          <p className="text-neutral-500">Controle de ingredientes e embalagens</p>
        </div>
        <Button onClick={() => {
          setEditingInsumo(null);
          setFormData({
            nome: '',
            categoria: 'Outros',
            unidadeMedida: activeTab === 'INGREDIENTE' ? 'g' : 'un',
            pesoEmbalagem: '',
            valorEmbalagem: '',
            preco: '0',
            estoqueAtual: '0',
            estoqueMinimo: '0',
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input 
          placeholder={`Buscar ${activeTab === 'INGREDIENTE' ? 'ingrediente' : 'embalagem'}...`} 
          className="pl-10 bg-neutral-50 border-neutral-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden border-neutral-200">
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
                  <th className="py-4 px-6 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Estoque</th>
                  <th className="py-4 px-6 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">Custo Unit.</th>
                  <th className="py-4 px-6 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">FC</th>
                  <th className="py-4 px-6 text-right text-xs font-bold text-neutral-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredInsumos.map((insumo) => {
                  const isLowStock = insumo.estoqueAtual <= insumo.estoqueMinimo;
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
                        {insumo.estoqueAtual <= 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider border border-red-100">
                            <AlertCircle className="w-3 h-3" />
                            Esgotado
                          </span>
                        ) : insumo.estoqueAtual <= insumo.estoqueMinimo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                            <AlertCircle className="w-3 h-3" />
                            Baixo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                            <TrendingUp className="w-3 h-3" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className={cn(
                            "font-bold text-sm",
                            isLowStock ? "text-orange-500" : "text-neutral-900"
                          )}>
                            {insumo.estoqueAtual} {insumo.unidadeMedida}
                          </span>
                          <span className="text-[10px] text-neutral-400">Mín: {insumo.estoqueMinimo}</span>
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
                          <Button 
                            onClick={() => setSelectedInsumoId(insumo.id!)} 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-orange-500 hover:bg-orange-50"
                            title="Ver Histórico"
                          >
                            <History className="w-4 h-4" />
                          </Button>
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

      {/* Histórico Recente */}
      <Card className="p-6">
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
              className="pl-10 h-9 text-sm bg-neutral-50 border-neutral-200"
              value={searchTermHistory}
              onChange={(e) => setSearchTermHistory(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2">Data</th>
                <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2">Insumo</th>
                <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2">Tipo</th>
                <th className="pb-4 font-bold text-xs text-neutral-400 uppercase tracking-wider px-2 text-right">Qtd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredTransacoes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-neutral-400 italic">
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
                        {formatNumber(t.quantidade)} {insumo?.unidadeMedida}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
                    <Label className="flex items-center gap-1.5">
                      {activeTab === 'INGREDIENTE' ? 'Peso Total na Embalagem *' : 'Qtd Total na Embalagem *'}
                    </Label>
                    <Input 
                      required
                      type="number" 
                      step="0.001"
                      value={formData.pesoEmbalagem}
                      onChange={e => handleInputChange('pesoEmbalagem', e.target.value)}
                      placeholder={activeTab === 'INGREDIENTE' ? "Ex: 1000" : "Ex: 100"} 
                    />
                    <p className="text-[10px] text-neutral-400 mt-1 italic">
                      {activeTab === 'INGREDIENTE' ? 'Peso total do fardo/caixa (g ou ml)' : 'Qtd total de unidades no pacote'}
                    </p>
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

                {/* Seção 3: Estoque e Fornecedor */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <Box className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Estoque e Fornecedor</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-1.5">Estoque Inicial *</Label>
                    <Input 
                      required
                      type="number" 
                      step="0.001"
                      disabled={!!editingInsumo}
                      className={cn(editingInsumo && "bg-neutral-100 cursor-not-allowed opacity-70")}
                      value={formData.estoqueAtual}
                      onChange={e => setFormData({...formData, estoqueAtual: e.target.value})}
                      placeholder="Ex: 500" 
                    />
                    {editingInsumo && (
                      <div className="flex items-start gap-1.5 mt-1.5 text-indigo-600">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        <p className="text-[10px] italic leading-tight">
                          Para alterar o estoque, utilize o módulo de <strong>Controle de Estoque</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5">Estoque Mínimo</Label>
                    <Input 
                      type="number" 
                      step="0.001"
                      value={formData.estoqueMinimo}
                      onChange={e => setFormData({...formData, estoqueMinimo: e.target.value})}
                      placeholder="Ex: 500" 
                    />
                    <p className="text-[10px] text-neutral-400 mt-1 italic">Alerta de estoque baixo</p>
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-1.5">
                    <Truck className="w-3 h-3" />
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
