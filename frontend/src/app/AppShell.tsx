import { Navigate, Route, Routes } from 'react-router-dom'
import { ListsOverviewPage } from '../features/lists/ListsOverviewPage'
import { ShoppingListDetailPage } from '../features/lists/ShoppingListDetailPage'
import { ShoppingStatsPage } from '../features/lists/ShoppingStatsPage'

export function AppShell() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/anna" />} />
      <Route path="/:actorName" element={<ListsOverviewPage />} />
      <Route path="/:actorName/statistik" element={<ShoppingStatsPage />} />
      <Route path="/:actorName/lists/:listId" element={<Navigate replace to="varor" />} />
      <Route path="/:actorName/lists/:listId/varor" element={<ShoppingListDetailPage />} />
      <Route path="/:actorName/lists/:listId/varor/search" element={<ShoppingListDetailPage />} />
      <Route path="/:actorName/lists/:listId/varor/search/fler" element={<ShoppingListDetailPage />} />
      <Route path="/:actorName/lists/:listId/checklista" element={<ShoppingListDetailPage />} />
    </Routes>
  )
}
