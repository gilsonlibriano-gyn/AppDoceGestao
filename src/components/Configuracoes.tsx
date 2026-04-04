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
  Trash2,
  Download,
  Upload,
  AlertCircle
} from 'lucide-react';
import { Button, Input, Label, Card, CardHeader, CardContent, Badge } from './ui/Common';
import { formatCurrency, cleanNumericInput, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';
import { supabase } from '../supabase';
import { Configuracoes as ConfiguracoesType } from '../types';
import { CostService } from '../services/costService';
import { BackupService, ImportResult } from '../services/backupService';
import { ConfirmModal } from './ui/ConfirmModal';

export function Configuracoes() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);

  const [settings, setSettings] = React.useState<any>({
    diasTrabalhadosMes: '22',
    horasTrabalhadasDia: '8',
    valorMensalPretendido: '1800',
    custoKwh: '0.91',
    equipamentos: [
      { id: '1', nome: 'Liquidificador', potenciaW: 700 },
      { id: '2', nome: 'Batedeira', potenciaW: 750 },
      { id: '3', nome: 'Forno elétrico', potenciaW: 1750 },
      { id: '4', nome: 'Processador', potenciaW: 600 },
      { id: '5', nome: 'Micro-ondas', potenciaW: 500 },
    ],
    tipoBotijao: 'P13',
    valorBotijao: '115',
    taxaImpostos: '5',
    lucroPretendidoPercentual: '30',
    uid: ''
  });

  const [newEquip, setNewEquip] = React.useState({ nome: '', potenciaW: '' });

  const addEquipamento = () => {
    if (!newEquip.nome || parseFloat(newEquip.potenciaW) <= 0) return;
    const id = Math.random().toString(36).substr(2, 9);
    setSettings({
      ...settings,
      equipamentos: [...settings.equipamentos, { ...newEquip, potenciaW: parseFloat(newEquip.potenciaW), id }]
    });
    setNewEquip({ nome: '', potenciaW: '' });
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
        const data = await dbService.getSingleByUid<ConfiguracoesType>('configuracoes', user.id);

        if (data) {
          setSettings({
            ...settings,
            ...data,
            diasTrabalhadosMes: data.diasTrabalhadosMes.toString(),
            horasTrabalhadasDia: data.horasTrabalhadasDia.toString(),
            valorMensalPretendido: data.valorMensalPretendido.toString(),
            custoKwh: data.custoKwh.toString(),
            valorBotijao: data.valorBotijao.toString(),
            taxaImpostos: data.taxaImpostos.toString(),
            lucroPretendidoPercentual: data.lucroPretendidoPercentual.toString(),
            uid: user.id
          });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
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
      const existing = await dbService.getSingleByUid<any>('configuracoes', user.id);

      const data = {
        ...settings,
        diasTrabalhadosMes: parseFloat(settings.diasTrabalhadosMes) || 0,
        horasTrabalhadasDia: parseFloat(settings.horasTrabalhadasDia) || 0,
        valorMensalPretendido: parseFloat(settings.valorMensalPretendido) || 0,
        custoKwh: parseFloat(settings.custoKwh) || 0,
        valorBotijao: parseFloat(settings.valorBotijao) || 0,
        taxaImpostos: parseFloat(settings.taxaImpostos) || 0,
        lucroPretendidoPercentual: parseFloat(settings.lucroPretendidoPercentual) || 0,
        uid: user.id,
        updatedAt: new Date().toISOString()
      };

      if (existing) {
        await dbService.update('configuracoes', existing.id, data);
      } else {
        await dbService.create('configuracoes', {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      await BackupService.exportData(user.id);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!user || !file) return;
    setPendingFile(file);
    setIsImportConfirmOpen(true);
    e.target.value = ''; // Reset input so same file can be selected again
  };

  const confirmImport = async () => {
    if (!user || !pendingFile) return;

    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await BackupService.importData(user.id, pendingFile);
      setImportResult(result);
    } catch (error) {
      console.error('Error in handleImport:', error);
      setImportResult({ success: false, message: 'Erro inesperado ao importar o backup.' });
    } finally {
      setIsImporting(false);
      setPendingFile(null);
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
        <p className="text-neutral-500">Ajuste os parâmetros para cálculos precisos de custos e precificação.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Mão de Obra */}
          <Card>
            <CardHeader>
              <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Custo com Mão de Obra
              </h3>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div>
                <Label>Dias por mês dedicados na produção</Label>
                <Input 
                  type="number" 
                  value={settings.diasTrabalhadosMes} 
                  onChange={(e) => setSettings({ ...settings, diasTrabalhadosMes: cleanNumericInput(e.target.value) })}
                />
              </div>

              <div>
                <Label>Horas por dia dedicadas na produção</Label>
                <Input 
                  type="number" 
                  value={settings.horasTrabalhadasDia} 
                  onChange={(e) => setSettings({ ...settings, horasTrabalhadasDia: cleanNumericInput(e.target.value) })}
                />
              </div>

              <div>
                <Label>Valor mensal pretendido (R$)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
                  <Input 
                    type="number" 
                    value={settings.valorMensalPretendido} 
                    onChange={(e) => setSettings({ ...settings, valorMensalPretendido: cleanNumericInput(e.target.value) })}
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
            </CardContent>
          </Card>

          {/* Gás */}
          <Card>
            <CardHeader>
              <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Custo com Gás
              </h3>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
                      onChange={(e) => setSettings({ ...settings, valorBotijao: cleanNumericInput(e.target.value) })}
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Energia */}
          <Card>
            <CardHeader>
              <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Custo com Energia
              </h3>
            </CardHeader>
            
            <CardContent>
              <div className="mb-6">
                <Label>Custo do kWh (R$)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={settings.custoKwh} 
                    onChange={(e) => setSettings({ ...settings, custoKwh: cleanNumericInput(e.target.value) })}
                    className="pl-12" 
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                  <div className="flex-1">
                    <Label>Equipamento</Label>
                    <Input 
                      placeholder="Nome do equipamento" 
                      value={newEquip.nome}
                      onChange={(e) => setNewEquip({ ...newEquip, nome: e.target.value })}
                    />
                  </div>
                  <div className="w-full sm:w-24">
                    <Label>Potência W</Label>
                    <Input 
                      type="number" 
                      placeholder="W" 
                      value={newEquip.potenciaW}
                      onChange={(e) => setNewEquip({ ...newEquip, potenciaW: cleanNumericInput(e.target.value) })}
                    />
                  </div>
                  <Button size="sm" onClick={addEquipamento} className="h-11">Add</Button>
                </div>

                <div className="hidden sm:block overflow-x-auto rounded-xl border border-neutral-100">
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
                    </tbody>
                  </table>
                </div>

                <div className="sm:hidden space-y-3">
                  {settings.equipamentos.map((e) => (
                    <div key={e.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-neutral-900">{e.nome}</p>
                        <p className="text-xs text-neutral-500">{e.potenciaW}W • {formatCurrency(CostService.calculateEnergyCost(e.potenciaW, 60, settings.custoKwh))}/h</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-neutral-400 hover:text-red-500" onClick={() => removeEquipamento(e.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {settings.equipamentos.length === 0 && (
                  <div className="p-8 text-center text-neutral-400 italic text-xs border-2 border-dashed border-neutral-100 rounded-2xl">
                    Nenhum equipamento adicionado.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                Impostos & Margem
              </h3>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div>
                <Label>Taxa de Impostos (%)</Label>
                <Input 
                  type="number" 
                  value={settings.taxaImpostos} 
                  onChange={(e) => setSettings({ ...settings, taxaImpostos: cleanNumericInput(e.target.value) })}
                />
              </div>

              <div>
                <Label>Meta de Lucro Padrão (%)</Label>
                <Input 
                  type="number" 
                  value={settings.lucroPretendidoPercentual} 
                  onChange={(e) => setSettings({ ...settings, lucroPretendidoPercentual: cleanNumericInput(e.target.value) })}
                />
                <p className="text-[10px] text-neutral-400 mt-1 italic">Usado como base para novos produtos e no dashboard.</p>
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
            </CardContent>
          </Card>

          {/* Backup e Restauração */}
          <Card>
            <CardHeader>
              <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                <Save className="w-5 h-5 text-indigo-500" />
                Backup e Restauração
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-neutral-500 leading-relaxed">
                Exporte seus dados para um arquivo JSON para manter uma cópia de segurança ou restaurar em outra conta.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Exportar Dados
                </Button>
                
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={isImporting}
                  />
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    disabled={isImporting}
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Importar Backup
                  </Button>
                </div>
              </div>
            </CardContent>
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

      {importResult && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <CardContent className="p-6 space-y-6">
              <div className="text-center space-y-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center mx-auto",
                  importResult.success ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                )}>
                  {importResult.success ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">
                    {importResult.success ? 'Importação Concluída' : 'Erro na Importação'}
                  </h3>
                  <p className="text-sm text-neutral-500 mt-1">{importResult.message}</p>
                </div>
              </div>

              {importResult.details && importResult.details.length > 0 && (
                <div className="bg-neutral-50 rounded-xl border border-neutral-100 overflow-hidden">
                  <div className="max-h-[200px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100/50 text-neutral-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-2">Módulo</th>
                          <th className="px-4 py-2 text-center">Sucesso</th>
                          <th className="px-4 py-2 text-center">Falhas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {importResult.details.map((detail, idx) => (
                          <tr key={idx} className="hover:bg-white transition-colors">
                            <td className="px-4 py-2 font-medium text-neutral-700">{detail.table}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={cn("font-bold", detail.imported > 0 ? "text-emerald-600" : "text-neutral-400")}>
                                {detail.imported}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={cn("font-bold", detail.errors > 0 ? "text-red-600" : "text-neutral-400")}>
                                {detail.errors}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button onClick={() => setImportResult(null)} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Entendido
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmModal 
        isOpen={isImportConfirmOpen}
        onClose={() => {
          setIsImportConfirmOpen(false);
          setPendingFile(null);
        }}
        onConfirm={confirmImport}
        title="Restaurar Backup"
        message="Atenção: A importação irá adicionar os dados do backup à sua conta atual. Deseja continuar?"
        confirmLabel="Sim, Importar"
        cancelLabel="Cancelar"
        variant="primary"
      />
    </div>
  );
}
