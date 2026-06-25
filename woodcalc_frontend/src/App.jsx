import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RoleSelect from './pages/auth/RoleSelect';
import Login from './pages/auth/Login';
import RegisterCustomer from './pages/auth/RegisterCustomer';
import RegisterArchitect from './pages/auth/RegisterArchitect';
import RegisterManufacturer from './pages/auth/RegisterManufacturer';
import RegisterSupplier from './pages/auth/RegisterSupplier';
import Dashboard from './pages/Dashboard';
import KitchenPlannerModule from './features/kitchen_planner/KitchenPlannerModule';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token');
  return token ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RoleSelect />} />
        <Route path="/register/customer" element={<RegisterCustomer />} />
        <Route path="/register/architect" element={<RegisterArchitect />} />
        <Route path="/register/manufacturer" element={<RegisterManufacturer />} />
        <Route path="/register/supplier" element={<RegisterSupplier />} />
<Route path="/kitchen-planner" element={
  <PrivateRoute>
    <KitchenPlannerModule />
  </PrivateRoute>
} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Dashboard placeholder */}
        <Route path="/dashboard" element={
  <PrivateRoute>
    <Dashboard />
  </PrivateRoute>
} />

         
      </Routes>
    </BrowserRouter>
  );
}
