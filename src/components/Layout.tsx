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

const LOGO_URL = "https://i.postimg.cc/TK7KPzdY/Logo-Doce-Gestao-Precificacao-com-doces.png";

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Insumos', path: '/insumos' },
  { icon: ChefHat, label: 'Receitas', path: '/receitas' },
  { icon: ChefHat, label: 'Fichas Técnicas', path: '/fichas-tecnicas' },
  { icon: Wallet, label: 'Custos Fixos', path: '/custos-fixos' },
  { icon: TrendingUp, label: 'Depreciação', path: '/depreciacao' },
  { icon: Calculator, label: 'Precificação', path: '/precificacao' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const { user, loading, error, signIn, signUp, logout } = useAuth();

  React.useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isSidebarOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      await signUp(email, password);
    } else {
      await signIn(email, password);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center animate-bounce shadow-lg shadow-orange-100 overflow-hidden">
            <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <p className="text-neutral-500 font-medium animate-pulse">Carregando Doce Gestão...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-neutral-100 p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-100 overflow-hidden">
            <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2 text-center">
            {isSignUp ? 'Criar sua conta' : 'Bem-vindo ao Doce Gestão'}
          </h1>
          <p className="text-neutral-500 mb-8 text-center">
            {isSignUp 
              ? 'Comece a gerenciar seus custos hoje mesmo.' 
              : 'Gestão de custos e precificação para confeitaria.'}
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Usuário ou E-mail</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                placeholder="••••"
              />
            </div>
            <Button type="submit" className="w-full py-4 text-lg">
              {isSignUp ? <UserIcon className="w-5 h-5 mr-2" /> : <LogIn className="w-5 h-5 mr-2" />}
              {isSignUp ? 'Cadastrar' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-neutral-100">
            <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <span className="font-bold text-neutral-900">Doce Gestão</span>
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
        "fixed inset-y-0 left-0 z-[100] w-64 bg-white border-r transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 h-[100dvh] md:h-auto",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          {/* Mobile Sidebar Header */}
          <div className="flex md:hidden items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <img src={LOGO_URL} alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <div className="flex flex-col">
                <span className="font-bold text-neutral-900 leading-none">Doce Gestão</span>
                <span className="text-[10px] text-orange-500 font-bold">Precificação v1.2</span>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 px-6 py-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-100 overflow-hidden border border-neutral-100">
              <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-neutral-900 text-lg leading-none">Doce Gestão</span>
              <span className="text-[10px] text-orange-500 mt-1 font-bold">Precificação v1.2</span>
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isSidebarOpen && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-around px-2 py-2 z-50 animate-in slide-in-from-bottom duration-300">
          {[navItems[0], navItems[1], navItems[2], navItems[6]].map((item) => {
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
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-neutral-500"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </nav>
      )}
    </div>
  );
}
