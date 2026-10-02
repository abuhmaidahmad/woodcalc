import React, { lazy as lazyReact, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RoleSelect from './pages/auth/RoleSelect';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import TrialBanner from './components/TrialBanner';
import FeedbackWidget from './components/FeedbackWidget';
import LanguageSwitcher from './components/LanguageSwitcher';
import { isStaff } from './api/auth';

// Every page is loaded on demand so a visitor only downloads the code for the
// route they open -- most importantly the public /view/:token 3D link, which
// customers open on their phones and shouldn't have to pull the whole ERP.
// A tab left open across a deploy still references the old chunk hashes, which
// no longer exist on the server -- reload once to pick up the new build
// instead of leaving the page blank.
const lazy = (load) => lazyReact(() => load().catch((err) => {
  if (!sessionStorage.getItem('chunk-reload')) {
    sessionStorage.setItem('chunk-reload', '1');
    window.location.reload();
    return new Promise(() => {});
  }
  throw err;
}).then((mod) => { sessionStorage.removeItem('chunk-reload'); return mod; }));
const RegisterCustomer = lazy(() => import('./pages/auth/RegisterCustomer'));
const RegisterArchitect = lazy(() => import('./pages/auth/RegisterArchitect'));
const RegisterManufacturer = lazy(() => import('./pages/auth/RegisterManufacturer'));
const RegisterSupplier = lazy(() => import('./pages/auth/RegisterSupplier'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const KitchenPlannerModule = lazy(() => import('./features/kitchen_planner/KitchenPlannerModule'));
const CuttingOptimizerModule = lazy(() => import('./features/manufacturing/CuttingOptimizerModule'));
const CadCamImport = lazy(() => import('./pages/CadCamImport'));
const CustomerList = lazy(() => import('./pages/CustomerList'));
const RoomDetail = lazy(() => import('./pages/RoomDetail'));
const ProductionBoard = lazy(() => import('./pages/ProductionBoard'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const MaterialCatalog = lazy(() => import('./pages/MaterialCatalog'));
const Collections = lazy(() => import('./pages/Collections'));
const SupplierList = lazy(() => import('./pages/SupplierList'));
const PurchaseOrderList = lazy(() => import('./pages/PurchaseOrderList'));
const SupplierStatement = lazy(() => import('./pages/SupplierStatement'));
const PurchaseOrderDetail = lazy(() => import('./pages/PurchaseOrderDetail'));
const EmployeeList = lazy(() => import('./pages/EmployeeList'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'));
const PayrollRun = lazy(() => import('./pages/PayrollRun'));
const MaterialList = lazy(() => import('./pages/MaterialList'));
const Settings = lazy(() => import('./pages/Settings'));
const BillingReturn = lazy(() => import('./pages/BillingReturn'));
const PublicCatalogBrowse = lazy(() => import('./pages/PublicCatalogBrowse'));
const KitchenShareView = lazy(() => import('./pages/KitchenShareView'));
const LeadList = lazy(() => import('./pages/LeadList'));
const LeadDesignView = lazy(() => import('./pages/LeadDesignView'));
const AdminCompanies = lazy(() => import('./pages/AdminCompanies'));
const AdminCompanyDetail = lazy(() => import('./pages/AdminCompanyDetail'));
const AdminFeedback = lazy(() => import('./pages/AdminFeedback'));

// Shown while a page's code chunk downloads (mostly right after a hard
// refresh). Matches the app's light background so there's no dark flash.
function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="page-loader-spinner" />
    </div>
  );
}

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

function AdminRoute({ children }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" />;
  if (!isStaff()) return <Navigate to="/dashboard" />;
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
      <LanguageSwitcher />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
        <Route path="/view/:token" element={<KitchenShareView />} />

        {/* Leads */}
        <Route path="/leads" element={
          <PrivateRoute><LeadList /></PrivateRoute>
        } />
        <Route path="/leads/:id/view" element={
          <PrivateRoute><LeadDesignView /></PrivateRoute>
        } />

        {/* Platform admin */}
        <Route path="/admin/companies" element={
          <AdminRoute><AdminCompanies /></AdminRoute>
        } />
        <Route path="/admin/companies/:id" element={
          <AdminRoute><AdminCompanyDetail /></AdminRoute>
        } />
        <Route path="/admin/feedback" element={
          <AdminRoute><AdminFeedback /></AdminRoute>
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

        {/* CAD/CAM Import */}
        <Route path="/cadcam-import" element={
          <PrivateRoute><CadCamImport /></PrivateRoute>
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

        {/* HR */}
        <Route path="/hr/employees" element={
          <PrivateRoute><EmployeeList /></PrivateRoute>
        } />
        <Route path="/hr/employees/:id" element={
          <PrivateRoute><EmployeeDetail /></PrivateRoute>
        } />
        <Route path="/hr/payroll" element={
          <PrivateRoute><PayrollRun /></PrivateRoute>
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
      </Suspense>
    </BrowserRouter>
  );
}
