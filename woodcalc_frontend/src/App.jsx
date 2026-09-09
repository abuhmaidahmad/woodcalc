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
import CuttingOptimizerModule from './features/manufacturing/CuttingOptimizerModule';
import CustomerList from './pages/CustomerList'
import RoomDetail from './pages/RoomDetail'
import ProductionBoard from './pages/ProductionBoard';
import CustomerDetail from './pages/CustomerDetail';
import ProjectDetail from './pages/ProjectDetail';
import MaterialCatalog from './pages/MaterialCatalog';
import Collections from './pages/Collections';
import SupplierList from './pages/SupplierList';
import PurchaseOrderList from './pages/PurchaseOrderList';
import SupplierStatement from './pages/SupplierStatement';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';
import MaterialList from './pages/MaterialList';
import Settings from './pages/Settings';
import BillingReturn from './pages/BillingReturn';
import PublicCatalogBrowse from './pages/PublicCatalogBrowse';
import LeadList from './pages/LeadList';
import LeadDesignView from './pages/LeadDesignView';
import TrialBanner from './components/TrialBanner';
import FeedbackWidget from './components/FeedbackWidget';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" />;
  return (
    <>
      <TrialBanner />
      {children}
      <FeedbackWidget />
    </>
  );
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

        {/* Kitchen Planner */}
        <Route path="/kitchen-planner" element={
          <PrivateRoute><KitchenPlannerModule /></PrivateRoute>
        } />
        <Route path="/browse/:companySlug" element={<PublicCatalogBrowse />} />

        {/* Leads */}
        <Route path="/leads" element={
          <PrivateRoute><LeadList /></PrivateRoute>
        } />
        <Route path="/leads/:id/view" element={
          <PrivateRoute><LeadDesignView /></PrivateRoute>
        } />

        {/* CRM */}
        <Route path="/collections" element={
          <PrivateRoute><Collections /></PrivateRoute>
        } />
        <Route path="/customers" element={
          <PrivateRoute><CustomerList /></PrivateRoute>
        } />
        <Route path="/customers/:id" element={
          <PrivateRoute><CustomerDetail /></PrivateRoute>
        } />
        <Route path="/projects/:id" element={
          <PrivateRoute><ProjectDetail /></PrivateRoute>
        } />

        {/* Room */}
        <Route path="/rooms/:id" element={
          <PrivateRoute><RoomDetail /></PrivateRoute>
        } />

        {/* Production */}
        <Route path="/production" element={
          <PrivateRoute><ProductionBoard /></PrivateRoute>
        } />

        {/* Cutting Optimizer */}
        <Route path="/cutting-optimizer" element={
          <PrivateRoute><CuttingOptimizerModule /></PrivateRoute>
        } />

        {/* Materials Catalog */}
        <Route path="/catalog" element={
          <PrivateRoute><MaterialCatalog /></PrivateRoute>
        } />

        {/* SRM */}
        <Route path="/suppliers" element={
          <PrivateRoute><SupplierList /></PrivateRoute>
        } />
        <Route path="/suppliers/:id/statement" element={
          <PrivateRoute><SupplierStatement /></PrivateRoute>
        } />
        <Route path="/purchase-orders" element={
          <PrivateRoute><PurchaseOrderList /></PrivateRoute>
        } />
        <Route path="/purchase-orders/:id" element={
          <PrivateRoute><PurchaseOrderDetail /></PrivateRoute>
        } />
        <Route path="/materials" element={
          <PrivateRoute><MaterialList /></PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute><Settings /></PrivateRoute>
        } />
        <Route path="/billing/return" element={
          <PrivateRoute><BillingReturn /></PrivateRoute>
        } />

        {/* Dashboard */}
        <Route path="/dashboard" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />

        {/* Default */}
        <Route path="/" element={<Navigate to="/customers" />} />
      </Routes>
    </BrowserRouter>
  );
}
