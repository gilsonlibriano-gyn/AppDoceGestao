/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  Loader2, 
  Check, 
  AlertCircle,
  Plus,
  Trash2,
  FileText
} from 'lucide-react';
import { Button, Input, Label, Card } from './ui/Common';
import { GoogleGenAI, Type } from "@google/genai";
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/dbService';

interface ExtractedItem {
  nome: string;
  quantidade: number;
  unidadeMedida: string;
  valorTotal: number;
  selected: boolean;
  categoria?: string;
}

interface NFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  activeTab: 'INGREDIENTE' | 'EMBALAGEM';
}

export function NFImportModal({ isOpen, onClose, onImportComplete, activeTab }: NFImportModalProps) {
  const { user } = useAuth();
  const [step, setStep] = React.useState<'upload' | 'processing' | 'review'>('upload');
  const [image, setImage] = React.useState<string | null>(null);
  const [extractedItems, setExtractedItems] = React.useState<ExtractedItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64Image: string) => {
    setStep('processing');
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const base64Data = base64Image.split(',')[1];
      
      const prompt = `Analise esta imagem de uma nota fiscal ou cupom fiscal e extraia os itens comprados que sejam ${activeTab === 'INGREDIENTE' ? 'ingredientes alimentícios' : 'embalagens'}. 
      Para cada item, identifique: 
      - nome (nome do produto)
      - quantidade (número de itens ou peso total na embalagem)
      - unidadeMedida (g, kg, ml, l, un)
      - valorTotal (valor total pago por aquele item/quantidade)
      
      Retorne os dados EXCLUSIVAMENTE em formato JSON seguindo este esquema: 
      { 
        "items": [
          { 
            "nome": "string", 
            "quantidade": number, 
            "unidadeMedida": "string", 
            "valorTotal": number 
          }
        ] 
      }
      
      Se a unidade de medida não estiver clara, tente inferir pelo contexto (ex: 1kg -> kg, 500g -> g, 1 UN -> un).
      Se não houver itens do tipo solicitado, retorne uma lista vazia.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nome: { type: Type.STRING },
                    quantidade: { type: Type.NUMBER },
                    unidadeMedida: { type: Type.STRING },
                    valorTotal: { type: Type.NUMBER }
                  },
                  required: ["nome", "quantidade", "unidadeMedida", "valorTotal"]
                }
              }
            },
            required: ["items"]
          }
        }
      });

      const result = JSON.parse(response.text);
      if (result.items && Array.isArray(result.items)) {
        setExtractedItems(result.items.map((item: any) => ({
          ...item,
          selected: true,
          categoria: 'Outros'
        })));
        setStep('review');
      } else {
        throw new Error("Não foi possível extrair os itens da imagem.");
      }
    } catch (err) {
      console.error("Erro ao processar imagem:", err);
      setError("Ocorreu um erro ao processar a imagem. Certifique-se de que a foto está nítida e tente novamente.");
      setStep('upload');
    }
  };

  const handleSave = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);

    try {
      const selectedItems = extractedItems.filter(i => i.selected);
      
      for (const item of selectedItems) {
        // Calculate unit price (preco)
        const preco = item.valorTotal / (item.quantidade || 1);
        
        await dbService.create('materias_primas', {
          nome: item.nome,
          categoria: item.categoria || 'Outros',
          unidadeMedida: item.unidadeMedida,
          pesoEmbalagem: item.quantidade,
          valorEmbalagem: item.valorTotal,
          preco: preco,
          fatorCorrecao: 1,
          tipo: activeTab,
          quantidadeItens: 1,
          uid: user.id
        });
      }

      onImportComplete();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar itens:", err);
      setError("Erro ao salvar alguns itens. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    setExtractedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const removeItem = (index: number) => {
    setExtractedItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ExtractedItem, value: any) => {
    setExtractedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold">Importar de Nota Fiscal</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-neutral-600">Tire uma foto ou envie uma imagem da sua nota fiscal ou cupom fiscal.</p>
                <p className="text-xs text-neutral-400">A IA irá identificar automaticamente os itens e preços para você.</p>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-200 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-neutral-700">Clique para selecionar ou arraste a imagem</p>
                  <p className="text-sm text-neutral-400">JPG, PNG ou PDF</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="h-14 rounded-2xl border-neutral-200"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-5 h-5 mr-2 text-neutral-500" />
                  Tirar Foto
                </Button>
                <Button 
                  variant="outline" 
                  className="h-14 rounded-2xl border-neutral-200"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5 mr-2 text-neutral-500" />
                  Galeria
                </Button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-red-600 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}

          {step === 'processing' && (
            <div className="py-20 flex flex-col items-center justify-center gap-6 text-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-neutral-900">Processando Nota Fiscal...</h3>
                <p className="text-neutral-500 max-w-xs mx-auto">Nossa inteligência artificial está lendo os itens e valores da sua nota. Isso pode levar alguns segundos.</p>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-neutral-900">Itens Identificados ({extractedItems.length})</h3>
                <p className="text-xs text-neutral-400">Revise os dados antes de salvar</p>
              </div>

              <div className="space-y-3">
                {extractedItems.map((item, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "p-4 rounded-2xl border transition-all",
                      item.selected ? "border-indigo-200 bg-indigo-50/30" : "border-neutral-100 bg-neutral-50 opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <button 
                        onClick={() => toggleItemSelection(index)}
                        className={cn(
                          "mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                          item.selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-neutral-300 bg-white"
                        )}
                      >
                        {item.selected && <Check className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input 
                            value={item.nome}
                            onChange={(e) => updateItem(index, 'nome', e.target.value)}
                            className="h-9 font-bold text-neutral-900 bg-transparent border-none p-0 focus:ring-0"
                          />
                          <button 
                            onClick={() => removeItem(index)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Qtd/Peso</Label>
                            <Input 
                              type="number"
                              value={item.quantidade}
                              onChange={(e) => updateItem(index, 'quantidade', parseFloat(e.target.value))}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Unidade</Label>
                            <select 
                              value={item.unidadeMedida}
                              onChange={(e) => updateItem(index, 'unidadeMedida', e.target.value)}
                              className="w-full h-8 px-2 text-xs rounded-lg border border-neutral-200 bg-white"
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="ml">ml</option>
                              <option value="l">l</option>
                              <option value="un">un</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Valor Total</Label>
                            <Input 
                              type="number"
                              value={item.valorTotal}
                              onChange={(e) => updateItem(index, 'valorTotal', parseFloat(e.target.value))}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {extractedItems.length === 0 && (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <p className="text-neutral-500">Nenhum item compatível encontrado na nota.</p>
                  <Button variant="outline" onClick={() => setStep('upload')}>Tentar Outra Foto</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between shrink-0">
          {step === 'review' ? (
            <>
              <Button variant="ghost" onClick={() => setStep('upload')}>Voltar</Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button 
                  onClick={handleSave} 
                  isLoading={isSaving}
                  disabled={extractedItems.filter(i => i.selected).length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px]"
                >
                  Importar Selecionados
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
