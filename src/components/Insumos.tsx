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
  Info
} from 'lucide-react';
import { Button, Input, Label, Card } from './ui/Common';
import { ConfirmModal } from './ui/ConfirmModal';
import { formatCurrency, cn } from '../lib/utils';
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
    tipo: 'INGREDIENTE' as 'INGREDIENTE' | 'EMBALAGEM'
  });

  // Calculate unit price automatically
  React.useEffect(() => {
    const peso = parseFloat(formData.pesoEmbalagem);
    const valor = parseFloat(formData.valorEmbalagem);
    const fc = parseFloat(formData.fatorCorrecao) || 1;
    if (peso > 0 && valor >= 0) {
      const unitPrice = (valor / peso) * fc;
      setFormData(prev => ({ ...prev, preco: unitPrice.toFixed(4) }));
    }
  }, [formData.pesoEmbalagem, formData.valorEmbalagem, formData.fatorCorrecao]);

  const fetchInsumos = React.useCallback(async () => {
    if (!user) return;
    try {
      const data = await dbService.list<MateriaPrima>('materias_primas', user.id);
      setInsumos(data);
    } catch (error) {
      console.error('Erro ao carregar insumos:', error);
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
      return () => { unsubInsumos(); };
    }
  }, [user, fetchInsumos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
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
        uid: user.id
      };

      if (editingInsumo) {
        await dbService.update('materias_primas', editingInsumo.id!, data);
      } else {
        const existing = insumos.find(i => 
          i.nome.toLowerCase().trim() === formData.nome.toLowerCase().trim() && 
          (i.tipo || 'INGREDIENTE') === formData.tipo
        );

        if (existing) {
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

          await dbService.update('materias_primas', existing.id!, {
            ...data,
            estoqueAtual: updatedStock,
            preco: updatedPrice
          });

          if (newQuantity > 0) {
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
          const created = await dbService.create<MateriaPrima>('materias_primas', {
            ...data,
            estoqueAtual: estoqueAtualNum
          });

          if (estoqueAtualNum > 0) {
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
        tipo: activeTab
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
      tipo: insumo.tipo || 'INGREDIENTE'
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
            tipo: activeTab
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
          <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingInsumo ? `Editar ${activeTab === 'INGREDIENTE' ? 'Ingrediente' : 'Embalagem'}` : `Novo ${activeTab === 'INGREDIENTE' ? 'Ingrediente' : 'Embalagem'}`}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-1.5">
                      {activeTab === 'INGREDIENTE' ? 'Peso na Embalagem *' : 'Qtd na Embalagem *'}
                    </Label>
                    <Input 
                      required
                      type="number" 
                      step="0.001"
                      value={formData.pesoEmbalagem}
                      onChange={e => setFormData({...formData, pesoEmbalagem: e.target.value})}
                      placeholder={activeTab === 'INGREDIENTE' ? "Ex: 1000" : "Ex: 100"} 
                    />
                    <p className="text-[10px] text-neutral-400 mt-1 italic">
                      {activeTab === 'INGREDIENTE' ? 'Peso total (ex: 1000g ou 1kg)' : 'Qtd total (ex: 100 unidades)'}
                    </p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5">Valor Pago (R$) *</Label>
                    <Input 
                      required
                      type="number" 
                      step="0.01"
                      value={formData.valorEmbalagem}
                      onChange={e => setFormData({...formData, valorEmbalagem: e.target.value})}
                      placeholder="Ex: 6.99" 
                    />
                    <p className="text-[10px] text-neutral-400 mt-1 italic">Preço pago pela embalagem fechada</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-center">
                    <Label className="text-emerald-700 flex items-center gap-1.5 font-bold mb-1">
                      <Calculator className="w-4 h-4" />
                      Custo por {formData.unidadeMedida}
                    </Label>
                    <div className="text-2xl font-black text-emerald-600 tracking-tight">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(parseFloat(formData.preco) || 0)}
                    </div>
                    <p className="text-[10px] text-emerald-600/70 mt-1 italic leading-tight">
                      Calculado: Valor / Peso (ou Qtd)
                    </p>
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

            <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} isLoading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                {editingInsumo ? 'Salvar Alterações' : 'Salvar Ingrediente'}
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
