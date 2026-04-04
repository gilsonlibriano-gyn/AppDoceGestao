/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Plus, 
  TrendingUp, 
  Trash2, 
  Edit2,
  Calendar,
  Layers,
  X,
  Loader2
} from 'lucide-react';
import { Button, Input, Label, Card, CardHeader, CardContent, Badge } from './ui/Common';
import { ConfirmModal } from './ui/ConfirmModal';
import { formatCurrency, cn, cleanNumericInput } from '../lib/utils';
import { BemDepreciavel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { CostService } from '../services/costService';

const CATEGORIAS_DEPRECIACAO = [
  { nome: 'Máquinas e Equipamentos', taxa: 10, vidaUtil: 120 },
  { nome: 'Móveis e Utensílios', taxa: 10, vidaUtil: 120 },
  { nome: 'Instalações', taxa: 10, vidaUtil: 120 },
  { nome: 'Veículos (geral)', taxa: 20, vidaUtil: 60 },
  { nome: 'Computadores e Periféricos', taxa: 20, vidaUtil: 60 },
  { nome: 'Ferramentas', taxa: 15, vidaUtil: 72 },
  { nome: 'Outros', taxa: 10, vidaUtil: 120 },
];

export function Depreciacao() {
  const { user } = useAuth();
  const [bens, setBens] = React.useState<BemDepreciavel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingBem, setEditingBem] = React.useState<BemDepreciavel | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    nome: '',
    valor: '',
    vidaUtil: '120',
    dataCompra: new Date().toISOString().split('T')[0],
    taxaAnual: '10',
    categoria: 'Máquinas e Equipamentos'
  });

  React.useEffect(() => {
    if (!user) return;

    const timeout = setTimeout(() => setLoading(false), 2000);

    const unsubscribe = dbService.subscribe<BemDepreciavel>('bens_depreciaveis', user.id, (data) => {
      setBens(data);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [user]);

  const handleOpenModal = (bem?: BemDepreciavel) => {
    if (bem) {
      setEditingBem(bem);
      setFormData({ 
        nome: bem.nome, 
        valor: bem.valor.toString(),
        vidaUtil: bem.vidaUtil.toString(),
        dataCompra: bem.dataCompra,
        taxaAnual: ((bem as any).taxaAnual || 10).toString(),
        categoria: (bem as any).categoria || 'Máquinas e Equipamentos'
      });
    } else {
      setEditingBem(null);
      setFormData({ 
        nome: '', 
        valor: '',
        vidaUtil: '120',
        dataCompra: new Date().toISOString().split('T')[0],
        taxaAnual: '10',
        categoria: 'Máquinas e Equipamentos'
      });
    }
    setIsModalOpen(true);
  };

  const handleCategoryChange = (catNome: string) => {
    const cat = CATEGORIAS_DEPRECIACAO.find(c => c.nome === catNome);
    if (cat) {
      setFormData({
        ...formData,
        categoria: catNome,
        taxaAnual: cat.taxa.toString(),
        vidaUtil: cat.vidaUtil.toString()
      });
    } else {
      setFormData({ ...formData, categoria: catNome });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        valor: parseFloat(formData.valor) || 0,
        vidaUtil: parseInt(formData.vidaUtil) || 120,
        taxaAnual: parseFloat(formData.taxaAnual) || 10,
        uid: user.id,
        updatedAt: new Date().toISOString()
      };

      if (editingBem) {
        await dbService.update('bens_depreciaveis', editingBem.id!, data);
      } else {
        await dbService.create('bens_depreciaveis', {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving asset:', error);
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
      await dbService.delete('bens_depreciaveis', deletingId);
    } catch (error) {
      console.error('Error deleting asset:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const totalMensal = CostService.calculateTotalDepreciationMonthly(bens);
  const totalAtivos = bens.reduce((s, b) => s + b.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Depreciação de Bens</h1>
          <p className="text-neutral-500">Controle o desgaste dos seus ativos fixos.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Bem
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p>Carregando ativos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Mobile Card List */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {bens.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-neutral-400 italic">
                    Nenhum bem cadastrado.
                  </CardContent>
                </Card>
              ) : (
                bens.map((bem) => (
                  <Card key={bem.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-neutral-900">{bem.nome}</h3>
                            <Badge variant="info" className="mt-1">{bem.categoria}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenModal(bem)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDelete(bem.id!)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-neutral-50">
                        <div>
                          <p className="text-[10px] text-neutral-400 uppercase font-bold">Valor Compra</p>
                          <p className="font-bold text-neutral-700">{formatCurrency(bem.valor)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-400 uppercase font-bold">Depr. Mensal</p>
                          <p className="font-bold text-orange-600">{formatCurrency(bem.valor / bem.vidaUtil)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block">
              <CardHeader>
                <h3 className="font-bold text-neutral-900">Lista de Ativos</h3>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <th className="pb-4 font-bold text-sm text-neutral-500 px-2">Bem</th>
                        <th className="pb-4 font-bold text-sm text-neutral-500 px-2">Valor Compra</th>
                        <th className="pb-4 font-bold text-sm text-neutral-500 px-2">Depr. Mensal</th>
                        <th className="pb-4 font-bold text-sm text-neutral-500 px-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {bens.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-neutral-400 italic">
                            Nenhum bem cadastrado.
                          </td>
                        </tr>
                      ) : (
                        bens.map((bem) => (
                          <tr key={bem.id} className="group hover:bg-neutral-50 transition-colors">
                            <td className="py-4 px-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500">
                                  <Layers className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium text-neutral-900">{bem.nome}</span>
                                  <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">{bem.categoria}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-2 text-neutral-600">
                              {formatCurrency(bem.valor)}
                            </td>
                            <td className="py-4 px-2 text-neutral-900 font-bold">
                              {formatCurrency(bem.valor / bem.vidaUtil)}
                            </td>
                            <td className="py-4 px-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleOpenModal(bem)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleDelete(bem.id!)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-orange-500 text-white border-none">
              <CardContent>
                <div className="flex items-center gap-2 text-orange-100 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Total Depreciação Mensal</span>
                </div>
                <h2 className="text-3xl font-black">{formatCurrency(totalMensal)}</h2>
                <p className="text-xs text-orange-100 mt-4 leading-relaxed">
                  Este valor é somado aos seus custos fixos para garantir que você esteja recuperando o investimento nos seus equipamentos.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  Resumo Fiscal
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 text-sm">
                  <span className="text-neutral-500">Total em Ativos</span>
                  <span className="font-bold text-neutral-900">{formatCurrency(totalAtivos)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 text-sm">
                  <span className="text-neutral-500">Taxa Média Anual</span>
                  <span className="font-bold text-neutral-900">
                    {bens.length > 0 ? (bens.reduce((s, b) => s + b.taxaAnual, 0) / bens.length).toFixed(1) : 0}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Modal Novo/Editar Bem */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md h-[90vh] md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-neutral-900">
                {editingBem ? 'Editar Bem' : 'Novo Bem'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <form id="depreciacao-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              <div className="space-y-2">
                <Label>Nome do Equipamento/Bem</Label>
                <Input 
                  required 
                  placeholder="Ex: Batedeira, Forno, Geladeira"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor de Compra (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    required 
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: cleanNumericInput(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vida Útil (meses)</Label>
                  <Input 
                    type="number" 
                    required 
                    value={formData.vidaUtil}
                    onChange={(e) => setFormData({ ...formData, vidaUtil: cleanNumericInput(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Taxa Anual (%)</Label>
                  <Input 
                    type="number" 
                    required 
                    value={formData.taxaAnual}
                    onChange={(e) => setFormData({ ...formData, taxaAnual: cleanNumericInput(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select 
                    className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    value={formData.categoria}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    {CATEGORIAS_DEPRECIACAO.map(cat => (
                      <option key={cat.nome} value={cat.nome}>{cat.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data da Compra</Label>
                <Input 
                  type="date" 
                  required 
                  value={formData.dataCompra}
                  onChange={(e) => setFormData({ ...formData, dataCompra: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4 shrink-0 p-6 border-t border-neutral-100 bg-neutral-50">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" form="depreciacao-form" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar
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
        title="Excluir Bem"
        message="Tem certeza que deseja excluir este bem? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
