/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Settings, 
  Users, 
  Flame, 
  Zap, 
  Clock,
  Save,
  Shield,
  LogOut,
  Loader2,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { Button, Input, Label, Card } from './ui/Common';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Configuracoes as ConfiguracoesType } from '../types';
import { CostService } from '../services/costService';

export function Configuracoes() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const [settings, setSettings] = React.useState<ConfiguracoesType>({
    diasTrabalhadosMes: 22,
    horasTrabalhadasDia: 8,
    valorMensalPretendido: 1800,
    custoKwh: 0.91,
    equipamentos: [
      { id: '1', nome: 'Liquidificador', potenciaW: 700 },
      { id: '2', nome: 'Batedeira', potenciaW: 750 },
      { id: '3', nome: 'Forno elétrico', potenciaW: 1750 },
      { id: '4', nome: 'Processador', potenciaW: 600 },
      { id: '5', nome: 'Micro-ondas', potenciaW: 500 },
    ],
    tipoBotijao: 'P13',
    valorBotijao: 115,
    taxaImpostos: 5,
    uid: ''
  });

  const [newEquip, setNewEquip] = React.useState({ nome: '', potenciaW: 0 });

  const addEquipamento = () => {
    if (!newEquip.nome || newEquip.potenciaW <= 0) return;
    const id = Math.random().toString(36).substr(2, 9);
    setSettings({
      ...settings,
      equipamentos: [...settings.equipamentos, { ...newEquip, id }]
    });
    setNewEquip({ nome: '', potenciaW: 0 });
  };

  const removeEquipamento = (id: string) => {
    setSettings({
      ...settings,
      equipamentos: settings.equipamentos.filter(e => e.id !== id)
    });
  };

  const horasTrabalhadasMes = settings.diasTrabalhadosMes * settings.horasTrabalhadasDia;
  const custoHoraMOD = horasTrabalhadasMes > 0 ? settings.valorMensalPretendido / horasTrabalhadasMes : 0;

  React.useEffect(() => {
    async function fetchSettings() {
      if (!user) return;
      try {
        const docRef = doc(db, 'configuracoes', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          setSettings({
            ...settings,
            ...data,
            uid: user.uid
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'configuracoes');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'configuracoes', user.uid), {
        ...settings,
        uid: user.uid,
        updatedAt: serverTimestamp()
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'configuracoes');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">Configurações de Custos</h1>
        <p className="text-neutral-500">Ajuste os parâmetros conforme Image 1 para cálculos precisos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Mão de Obra */}
          <Card className="p-6">
            <h3 className="font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Custo com Mão de Obra
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label>Dias por mês dedicados na produção</Label>
                <Input 
                  type="number" 
                  value={settings.diasTrabalhadosMes} 
                  onChange={(e) => setSettings({ ...settings, diasTrabalhadosMes: Number(e.target.value) })}
                />
              </div>

              <div>
                <Label>Horas por dia dedicadas na produção</Label>
                <Input 
                  type="number" 
                  value={settings.horasTrabalhadasDia} 
                  onChange={(e) => setSettings({ ...settings, horasTrabalhadasDia: Number(e.target.value) })}
                />
              </div>

              <div>
                <Label>Valor mensal pretendido (R$)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
                  <Input 
                    type="number" 
                    value={settings.valorMensalPretendido} 
                    onChange={(e) => setSettings({ ...settings, valorMensalPretendido: Number(e.target.value) })}
                    className="pl-12" 
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">Horas trabalhadas / mês</span>
                  <span className="text-lg font-bold text-blue-900">{horasTrabalhadasMes}h</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">Custo por hora</span>
                  <span className="text-lg font-bold text-blue-900">{formatCurrency(custoHoraMOD)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Gás */}
          <Card className="p-6">
            <h3 className="font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Custo com Gás
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <Label>Tipo de Botijão</Label>
                <select 
                  className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  value={settings.tipoBotijao}
                  onChange={(e) => setSettings({ ...settings, tipoBotijao: e.target.value as any })}
                >
                  <option value="P13">P13 (13kg)</option>
                  <option value="P45">P45 (45kg)</option>
                </select>
              </div>
              <div>
                <Label>Valor pago no botijão (R$)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
                  <Input 
                    type="number" 
                    value={settings.valorBotijao} 
                    onChange={(e) => setSettings({ ...settings, valorBotijao: Number(e.target.value) })}
                    className="pl-12" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Custo estimado por hora</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-100 text-center">
                  <span className="block text-[10px] text-neutral-500 uppercase font-bold">Baixo</span>
                  <span className="text-sm font-bold text-neutral-900">{formatCurrency(CostService.calculateGasCost('BAIXO', 60, settings))}</span>
                </div>
                <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-100 text-center">
                  <span className="block text-[10px] text-neutral-500 uppercase font-bold">Médio</span>
                  <span className="text-sm font-bold text-neutral-900">{formatCurrency(CostService.calculateGasCost('MEDIO', 60, settings))}</span>
                </div>
                <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-100 text-center">
                  <span className="block text-[10px] text-neutral-500 uppercase font-bold">Alto</span>
                  <span className="text-sm font-bold text-neutral-900">{formatCurrency(CostService.calculateGasCost('ALTO', 60, settings))}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Energia */}
          <Card className="p-6">
            <h3 className="font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Custo com Energia
            </h3>
            
            <div className="mb-6">
              <Label>Custo do kWh (R$)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
                <Input 
                  type="number" 
                  step="0.01"
                  value={settings.custoKwh} 
                  onChange={(e) => setSettings({ ...settings, custoKwh: Number(e.target.value) })}
                  className="pl-12" 
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Nome do equipamento" 
                  value={newEquip.nome}
                  onChange={(e) => setNewEquip({ ...newEquip, nome: e.target.value })}
                />
                <Input 
                  type="number" 
                  placeholder="Potência W" 
                  className="w-24"
                  value={newEquip.potenciaW || ''}
                  onChange={(e) => setNewEquip({ ...newEquip, potenciaW: Number(e.target.value) })}
                />
                <Button size="sm" onClick={addEquipamento}>Add</Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full text-left text-sm min-w-[500px]">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-2">Equipamento</th>
                      <th className="px-4 py-2">Potência W</th>
                      <th className="px-4 py-2">Custo/h</th>
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {settings.equipamentos.map((e) => (
                      <tr key={e.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-4 py-2 font-medium">{e.nome}</td>
                        <td className="px-4 py-2 text-neutral-600">{e.potenciaW}W</td>
                        <td className="px-4 py-2 font-bold text-neutral-900">{formatCurrency(CostService.calculateEnergyCost(e.potenciaW, 60, settings.custoKwh))}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-neutral-400 hover:text-red-500" onClick={() => removeEquipamento(e.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {settings.equipamentos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-neutral-400 italic text-xs">
                          Nenhum equipamento adicionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Impostos & Margem
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label>Taxa de Impostos (%)</Label>
                <Input 
                  type="number" 
                  value={settings.taxaImpostos} 
                  onChange={(e) => setSettings({ ...settings, taxaImpostos: Number(e.target.value) })}
                />
              </div>

              <Button className="w-full py-4 text-lg mt-4" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Salvar Configurações
              </Button>
              
              {showSuccess && (
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Configurações salvas com sucesso!
                </div>
              )}
            </div>
          </Card>

          <Button 
            variant="outline" 
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100"
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da Conta
          </Button>
        </div>
      </div>
    </div>
  );
}
