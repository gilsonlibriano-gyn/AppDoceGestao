/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ChefHat, 
  Wallet, 
  TrendingUp, 
  Settings, 
  Menu, 
  X,
  Calculator,
  History,
  LogOut,
  LogIn,
  User as UserIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Common';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Insumos', path: '/insumos' },
  { icon: History, label: 'Estoque', path: '/estoque' },
  { icon: ChefHat, label: 'Receitas', path: '/receitas' },
  { icon: Wallet, label: 'Custos Fixos', path: '/custos-fixos' },
  { icon: TrendingUp, label: 'Depreciação', path: '/depreciacao' },
  { icon: Calculator, label: 'Precificação', path: '/precificacao' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const { user, loading, error, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center animate-bounce shadow-lg shadow-orange-200">
            <ChefHat className="text-white w-7 h-7" />
          </div>
          <p className="text-neutral-500 font-medium animate-pulse">Carregando Deliciarte...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-neutral-100 p-8 text-center">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200">
            <ChefHat className="text-white w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Bem-vindo ao Deliciarte</h1>
          <p className="text-neutral-500 mb-8">Sincronize seus custos e receitas em todos os seus dispositivos.</p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <Button onClick={login} className="w-full py-4 text-lg">
            <LogIn className="w-5 h-5 mr-2" />
            Entrar com Google
          </Button>
          <p className="text-xs text-neutral-400 mt-6">
            Ao entrar, você concorda com nossos termos de uso e política de privacidade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <ChefHat className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-neutral-900">Deliciarte</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Sidebar (Desktop & Mobile Overlay) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="hidden md:flex items-center gap-3 px-6 py-8">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
              <ChefHat className="text-white w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-neutral-900 text-lg leading-none">Deliciarte</span>
              <span className="text-xs text-neutral-500 mt-1">Gestão de Custos</span>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-orange-50 text-orange-600 font-medium" 
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-orange-600" : "text-neutral-400 group-hover:text-neutral-600"
                  )} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-200">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt={user.user_metadata.full_name || ''} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-5 h-5 text-neutral-400" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-neutral-900 truncate">{user.user_metadata?.full_name || 'Usuário'}</span>
                <span className="text-xs text-neutral-500 truncate">{user.email}</span>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 text-neutral-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-around px-2 py-2 z-50">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors",
                isActive ? "text-orange-600" : "text-neutral-500"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
