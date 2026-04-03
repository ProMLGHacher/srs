/**
 * Точка входа SPA: монтируем React в #root, включаем клиентский роутинг.
 * StrictMode в dev дважды вызывает эффекты — это нормально для поиска побочных эффектов.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
