/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button, Card } from './Common';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
        <div className="p-6 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
            variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          
          <h3 className="text-lg font-bold text-neutral-900 mb-2">{title}</h3>
          <p className="text-sm text-neutral-500 mb-6">{message}</p>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={onClose}
            >
              {cancelLabel}
            </Button>
            <Button 
              variant={variant === 'danger' ? 'danger' : 'primary'} 
              className="flex-1" 
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
