import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import TwoFactorVerifyPage from './pages/TwoFactorVerifyPage';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-2fa" element={<TwoFactorVerifyPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        {/* Catch-all redirect to Landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
