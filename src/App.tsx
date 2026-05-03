/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Customers from './pages/Customers';
import Machines from './pages/Machines';
import Interventions from './pages/Interventions';
import Inventory from './pages/Inventory';
import Calendar from './pages/Calendar';
import WorkOrders from './pages/WorkOrders';
import Reminders from './pages/Reminders';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import EmailLog from './pages/EmailLog';
import CustomerPortal from './pages/CustomerPortal';
import TechnicianToday from './pages/TechnicianToday';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/vandaag" element={<Layout><TechnicianToday /></Layout>} />
            <Route path="/customers" element={<Layout><Customers /></Layout>} />
            <Route path="/machines" element={<Layout><Machines /></Layout>} />
            <Route path="/interventions" element={<Layout><Interventions /></Layout>} />
            <Route path="/calendar" element={<Layout><Calendar /></Layout>} />
            <Route path="/work-orders" element={<Layout><WorkOrders /></Layout>} />
            <Route path="/inventory" element={<Layout><Inventory /></Layout>} />
            <Route path="/reminders" element={<Layout><Reminders /></Layout>} />
            <Route path="/notifications" element={<Layout><Notifications /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="/email-log" element={<Layout><EmailLog /></Layout>} />
            <Route path="/audit-logs" element={<Layout><AuditLogs /></Layout>} />
            <Route path="/customer-portal" element={<Layout><CustomerPortal /></Layout>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}



