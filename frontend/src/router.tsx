import { createBrowserRouter, RouterProvider } from 'react-router'
import { AdminHomePage } from './admin/AdminHomePage.tsx'
import { AdminLayout } from './admin/AdminLayout.tsx'
import { AiPage } from './admin/ai/AiPage.tsx'
import { CoaPage } from './admin/coa/CoaPage.tsx'
import { PharmaciesPage } from './admin/pharmacies/PharmaciesPage.tsx'
import { PharmacyPage } from './admin/pharmacies/PharmacyPage.tsx'
import { RulesPage } from './admin/rules/RulesPage.tsx'
import { ClientHomePage } from './client/ClientHomePage.tsx'
import { ClientLayout } from './client/ClientLayout.tsx'
import { QuestionsPage } from './client/questions/QuestionsPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { RootRedirect } from './pages/RootRedirect.tsx'

/**
 * One app, two role areas:
 *   /login      sign-in for everyone
 *   /admin/...  staff (admin role)
 *   /client/... pharmacy owners (client role)
 */
const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminHomePage /> },
      { path: 'pharmacies', element: <PharmaciesPage /> },
      { path: 'pharmacies/:id', element: <PharmacyPage /> },
      { path: 'chart-of-accounts', element: <CoaPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'ai', element: <AiPage /> },
    ],
  },
  {
    path: '/client',
    element: <ClientLayout />,
    children: [
      { index: true, element: <ClientHomePage /> },
      { path: 'questions', element: <QuestionsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
