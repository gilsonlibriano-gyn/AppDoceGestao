/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Plus, 
  Wallet, 
  Trash2, 
  Edit2,
  DollarSign,
  PieChart,
  X,
  Loader2,
  GripVertical
} from 'lucide-react';
import { Button, Input, Label, Card, CardHeader, CardContent } from './ui/Common';
import { ConfirmModal } from './ui/ConfirmModal';
import { formatCurrency, cn, cleanNumericInput } from '../lib/utils';
import { CustoFixo } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { supabase } from '../supabase';

// DND Kit
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
  custo: CustoFixo;
  onEdit: (custo: CustoFixo) => void;
  onDelete: (id: string) => void;
}

function SortableRow({ custo, onEdit, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: custo.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  };

  return (
    <tr 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group hover:bg-neutral-50 transition-colors",
        isDragging && "bg-white shadow-lg ring-1 ring-black/5 z-10"
      )}
    >
      <td className="py-4 px-2">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            className="cursor-grab active:cursor-grabbing p-1 text-neutral-300 hover:text-neutral-500 transition-colors"
            {...attributes} 
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="font-medium text-neutral-900">{custo.nome}</span>
        </div>
      </td>
      <td className="py-4 px-2 text-neutral-900 font-bold">
        {formatCurrency(custo.valor)}
      </td>
      <td className="py-4 px-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => onEdit(custo)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDelete(custo.id!)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function CustosFixos() {
  const { user } = useAuth();
  const [custos, setCustos] = React.useState<CustoFixo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingCusto, setEditingCusto] = React.useState<CustoFixo | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    nome: '',
    valor: ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    if (!user) return;

    const timeout = setTimeout(() => setLoading(false), 2000);

    const unsubscribe = dbService.subscribe<CustoFixo>('custos_fixos', user.id, (data) => {
      // Sort by ordem if not already sorted by subscribe (dbService uses order('createdAt'))
      // Actually dbService.subscribe uses order('createdAt', { ascending: true })
      // We need to sort by 'ordem'
      setCustos(data.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [user]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = custos.findIndex((c) => c.id === active.id);
      const newIndex = custos.findIndex((c) => c.id === over.id);

      const newCustos = arrayMove(custos, oldIndex, newIndex);
      
      // Optimistic update
      setCustos(newCustos);

      // Update Supabase
      try {
        const updates = newCustos.map((custo, index) => ({
          id: custo.id,
          ordem: index,
          uid: user?.id,
          updatedAt: new Date().toISOString()
        }));

        const { error } = await supabase
          .from('custos_fixos')
          .upsert(updates);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating order:', error);
      }
    }
  };

  const handleOpenModal = (custo?: CustoFixo) => {
    if (custo) {
      setEditingCusto(custo);
      setFormData({ nome: custo.nome, valor: custo.valor.toString() });
    } else {
      setEditingCusto(null);
      setFormData({ nome: '', valor: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        valor: parseFloat(formData.valor) || 0,
        uid: user.id,
        updatedAt: new Date().toISOString()
      };

      if (editingCusto) {
        await dbService.update('custos_fixos', editingCusto.id!, data);
      } else {
        await dbService.create('custos_fixos', {
          ...data,
          ordem: custos.length,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving fixed cost:', error);
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
      await dbService.delete('custos_fixos', deletingId);
    } catch (error) {
      console.error('Error deleting fixed cost:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const total = custos.reduce((sum, c) => sum + c.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Custos Fixos</h1>
          <p className="text-neutral-500">Despesas mensais que não variam com a produção.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Custo Fixo
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p>Carregando custos fixos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Mobile Card List */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {custos.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-neutral-400 italic">
                    Nenhum custo fixo cadastrado.
                  </CardContent>
                </Card>
              ) : (
                custos.map((custo) => (
                  <Card key={custo.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500">
                            <Wallet className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-neutral-900">{custo.nome}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenModal(custo)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDelete(custo.id!)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-neutral-50">
                        <span className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Valor Mensal</span>
                        <span className="font-bold text-neutral-900">{formatCurrency(custo.valor)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block">
              <CardHeader>
                <h3 className="font-bold text-neutral-900">Lista de Custos</h3>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-neutral-100">
                          <th className="pb-4 font-bold text-sm text-neutral-500 px-2">Nome</th>
                          <th className="pb-4 font-bold text-sm text-neutral-500 px-2">Valor Mensal</th>
                          <th className="pb-4 font-bold text-sm text-neutral-500 px-2 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {custos.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-10 text-center text-neutral-400 italic">
                              Nenhum custo fixo cadastrado.
                            </td>
                          </tr>
                        ) : (
                          <SortableContext
                            items={custos.map(c => c.id!)}
                            strategy={verticalListSortingStrategy}
                          >
                            {custos.map((custo) => (
                              <SortableRow 
                                key={custo.id} 
                                custo={custo} 
                                onEdit={handleOpenModal}
                                onDelete={handleDelete}
                              />
                            ))}
                          </SortableContext>
                        )}
                      </tbody>
                    </table>
                  </DndContext>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-neutral-900 text-white border-none">
              <CardContent>
                <div className="flex items-center gap-2 text-neutral-400 mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Total Mensal</span>
                </div>
                <h2 className="text-3xl font-black">{formatCurrency(total)}</h2>
                <p className="text-xs text-neutral-400 mt-4 leading-relaxed">
                  Este valor é usado para calcular a taxa horária de rateio com base nas suas horas de produção.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-orange-500" />
                  Distribuição
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
                {custos.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-4">Sem dados para exibir.</p>
                ) : (
                  custos.map((custo) => {
                    const percent = total > 0 ? (custo.valor / total) * 100 : 0;
                    return (
                      <div key={custo.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-neutral-600">{custo.nome}</span>
                          <span className="font-bold text-neutral-900">{percent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 rounded-full" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Modal Novo/Editar Custo Fixo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md h-[90vh] md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-neutral-900">
                {editingCusto ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <form id="custo-fixo-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              <div className="space-y-2">
                <Label>Nome da Despesa</Label>
                <Input 
                  required 
                  placeholder="Ex: Aluguel, Internet, MEI"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Mensal (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  required 
                  placeholder="0,00"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: cleanNumericInput(e.target.value) })}
                />
              </div>

              <div className="flex gap-3 pt-4 shrink-0 p-6 border-t border-neutral-100 bg-neutral-50">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" form="custo-fixo-form" className="flex-1" disabled={isSubmitting}>
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
        title="Excluir Custo Fixo"
        message="Tem certeza que deseja excluir este custo fixo? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
