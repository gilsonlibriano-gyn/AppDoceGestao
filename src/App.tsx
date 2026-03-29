/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Insumos } from './components/Insumos';
import { Receitas } from './components/Receitas';
import { Precificacao } from './components/Precificacao';
import { Configuracoes } from './components/Configuracoes';
import { CustosFixos } from './components/CustosFixos';
import { Depreciacao } from './components/Depreciacao';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <Router>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/insumos" element={<Insumos />} />
            <Route path="/receitas" element={<Receitas />} />
            <Route path="/custos-fixos" element={<CustosFixos />} />
            <Route path="/depreciacao" element={<Depreciacao />} />
            <Route path="/precificacao" element={<Precificacao />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </Router>
  );
}
