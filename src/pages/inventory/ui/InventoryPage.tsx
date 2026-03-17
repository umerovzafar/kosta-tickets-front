import { useMediaQuery } from '@shared/hooks'
import { InventoryProvider } from '../model'
import { InventoryPageView } from './InventoryPageView'

export function InventoryPage() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <InventoryProvider isMobile={isMobile}>
      <InventoryPageView />
    </InventoryProvider>
  )
}
