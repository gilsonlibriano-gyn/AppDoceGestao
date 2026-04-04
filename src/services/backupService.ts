/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService } from './dbService';

export interface ImportDetail {
  table: string;
  imported: number;
  errors: number;
  lastError?: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  details?: ImportDetail[];
}

export class BackupService {
  private static TABLES = [
    'materias_primas',
    'receitas_base',
    'receitas',
    'configuracoes',
    'custos_fixos',
    'depreciacao'
  ];

  private static TABLE_LABELS: Record<string, string> = {
    'materias_primas': 'Insumos',
    'receitas_base': 'Receitas Base',
    'receitas': 'Fichas Técnicas',
    'configuracoes': 'Configurações',
    'custos_fixos': 'Custos Fixos',
    'depreciacao': 'Depreciação'
  };

  static async exportData(uid: string) {
    const backup: Record<string, any[]> = {};

    for (const table of this.TABLES) {
      try {
        const data = await dbService.list(table, uid);
        backup[table] = data;
      } catch (error) {
        console.error(`Error exporting table ${table}:`, error);
        backup[table] = [];
      }
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deliciarte_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async importData(uid: string, file: File): Promise<ImportResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const backup = JSON.parse(content);

          if (typeof backup !== 'object' || backup === null) {
            throw new Error('Formato de arquivo inválido');
          }

          const details: ImportDetail[] = [];
          let totalImported = 0;
          let totalErrors = 0;

          for (const table of this.TABLES) {
            const items = backup[table];
            if (Array.isArray(items)) {
              let tableImported = 0;
              let tableErrors = 0;
              let lastError = '';

              // Clear existing data for this table before importing
              try {
                await dbService.deleteAllByUid(table, uid);
              } catch (err) {
                console.error(`Error clearing table ${table}:`, err);
                // We continue anyway, but this might lead to duplicates if delete failed
              }

              for (const item of items) {
                try {
                  await dbService.create(table, { ...item, uid });
                  tableImported++;
                } catch (err) {
                  console.error(`Error importing item in ${table}:`, err);
                  tableErrors++;
                  lastError = err instanceof Error ? err.message : String(err);
                }
              }

              details.push({
                table: this.TABLE_LABELS[table] || table,
                imported: tableImported,
                errors: tableErrors,
                lastError: lastError || undefined
              });

              totalImported += tableImported;
              totalErrors += tableErrors;
            }
          }

          resolve({ 
            success: true, 
            message: `Importação concluída: ${totalImported} itens importados.${totalErrors > 0 ? ` ${totalErrors} erros ocorreram.` : ''}`,
            details
          });
        } catch (error) {
          console.error('Error importing backup:', error);
          resolve({ success: false, message: 'Erro ao processar o arquivo de backup.' });
        }
      };
      reader.onerror = () => resolve({ success: false, message: 'Erro ao ler o arquivo.' });
      reader.readAsText(file);
    });
  }
}
