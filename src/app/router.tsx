import { type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { routes } from '@shared/config'
import { ProtectedRoute } from '@app/ProtectedRoute'
import { GuestOnlyRoute } from '@app/GuestOnlyRoute'
import { PageTransition } from '@app/PageTransition'
import { TimeTrackingRoute } from '@app/TimeTrackingRoute'
import { ExpensesAccessRoute } from '@app/ExpensesAccessRoute'
import { ExpensesMgmtRoute } from '@app/ExpensesMgmtRoute'
import { AdminPage } from '@pages/admin'
import { AttendancePage, ExpensesPage, ExpensesReportPage, ExpensesRequestsPage, HelpPage, InventoryPage, RulesPage, TodoPage } from '@pages'
import { AuthCallbackPage } from '@pages/auth-callback'
import { HomePage } from '@pages/home'
import { LoginPage } from '@pages/login'
import { ProjectDetailPage } from '@pages/project-detail'
import { TicketDetailPage } from '@pages/ticket-detail'
import { UserEditPage } from '@pages/user-edit'

function withGuest(children: ReactNode) {
  return (
    <GuestOnlyRoute>
      <PageTransition>{children}</PageTransition>
    </GuestOnlyRoute>
  )
}

function withProtected(children: ReactNode, adminOnly = false) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <PageTransition>{children}</PageTransition>
    </ProtectedRoute>
  )
}

const router = createBrowserRouter([
  { path: routes.login, element: withGuest(<LoginPage />) },
  { path: routes.authCallback, element: <AuthCallbackPage /> },
  { path: routes.home, element: withProtected(<HomePage />) },
  { path: routes.ticketDetail, element: withProtected(<TicketDetailPage />) },
  { path: routes.attendance, element: withProtected(<AttendancePage />) },
  { path: routes.inventory, element: withProtected(<InventoryPage />) },
  { path: routes.timeTracking, element: withProtected(<TimeTrackingRoute />) },
  { path: routes.projectDetail, element: withProtected(<ProjectDetailPage />) },
  {
    path: routes.expenses,
    element: withProtected(
      <ExpensesAccessRoute>
        <ExpensesPage />
      </ExpensesAccessRoute>,
    ),
  },
  {
    path: routes.expensesRequests,
    element: withProtected(
      <ExpensesAccessRoute>
        <ExpensesMgmtRoute>
          <ExpensesRequestsPage />
        </ExpensesMgmtRoute>
      </ExpensesAccessRoute>,
    ),
  },
  {
    path: routes.expensesReport,
    element: withProtected(
      <ExpensesAccessRoute>
        <ExpensesMgmtRoute>
          <ExpensesReportPage />
        </ExpensesMgmtRoute>
      </ExpensesAccessRoute>,
    ),
  },
  { path: routes.todo, element: withProtected(<TodoPage />) },
  { path: routes.rules, element: withProtected(<RulesPage />) },
  { path: routes.help, element: withProtected(<HelpPage />) },
  { path: routes.admin, element: withProtected(<AdminPage />, true) },
  { path: routes.userEdit, element: withProtected(<UserEditPage />, true) },
  { path: '*', element: <Navigate to={routes.home} replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
