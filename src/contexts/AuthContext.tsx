/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check active sessions and sets the user if available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    
    // Map 'admin' username to a real email for cloud sync
    const targetEmail = email === 'admin' ? 'admin@deliciarte.com' : email;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      // If it's the admin and it doesn't exist yet, try to auto-create it (one-time setup)
      if (error && email === 'admin' && error.message === 'Invalid login credentials') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: { data: { full_name: 'Administrador' } }
        });
        
        if (!signUpError) {
          // Try sign in again after sign up
          const { error: secondSignInError } = await supabase.auth.signInWithPassword({ 
            email: targetEmail, 
            password 
          });
          if (secondSignInError) throw secondSignInError;
          return;
        }
        throw signUpError;
      }

      if (error) throw error;
    } catch (err: any) {
      console.error("Login error:", err);
      let message = "Erro ao entrar. Verifique seu e-mail e senha.";
      if (err.message === 'Invalid login credentials') {
        message = "E-mail ou senha incorretos. Verifique os dados ou cadastre-se.";
      } else if (err.message === 'Email not confirmed') {
        message = "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
      }
      setError(message);
    }
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      setError("Verifique seu e-mail para confirmar o cadastro.");
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "Erro ao cadastrar. Tente novamente.");
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
