import { Navigate, Route, Routes } from 'react-router-dom'
import { ListsOverviewPage } from '../features/lists/ListsOverviewPage'
import { ShoppingListDetailPage } from '../features/lists/ShoppingListDetailPage'

export function AppShell() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/anna" />} />
      <Route path="/:actorName" element={<ListsOverviewPage />} />
      <Route path="/:actorName/lists/:listId" element={<ShoppingListDetailPage />} />
    </Routes>
  )
}
