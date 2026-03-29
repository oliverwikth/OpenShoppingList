import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { toTitledName } from '../../../shared/displayName'
import type { ShoppingListItem } from '../../../shared/types/api'
import { claimPaletteStyle, formatQuantity, itemSubtitle } from './detailPageUtils'

interface ChecklistItemRowProps {
  isBusy: boolean
  item: ShoppingListItem
  onToggleCheck: (item: ShoppingListItem) => Promise<void>
  onToggleClaim: (item: ShoppingListItem) => Promise<void>
}

export function ChecklistItemRow({ isBusy, item, onToggleCheck, onToggleClaim }: ChecklistItemRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const swipeStartXRef = useRef<number | null>(null)
  const isSwipingRef = useRef(false)
  const claimDisplayName = item.claimedByDisplayName ? toTitledName(item.claimedByDisplayName) : null
  const claimStyle = item.claimedByDisplayName ? claimPaletteStyle(item.claimedByDisplayName) : undefined

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (isBusy || item.checked) {
      return
    }

    const target = event.target
    if (target instanceof HTMLElement && target.closest('button')) {
      return
    }

    swipeStartXRef.current = event.clientX
    isSwipingRef.current = false
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (swipeStartXRef.current === null) {
      return
    }

    const deltaX = event.clientX - swipeStartXRef.current
    if (deltaX < -6) {
      isSwipingRef.current = true
    }

    if (!isSwipingRef.current) {
      return
    }

    setSwipeOffset(Math.max(deltaX, -92))
  }

  function handlePointerLeave() {
    if (swipeStartXRef.current === null) {
      return
    }

    swipeStartXRef.current = null
    isSwipingRef.current = false
    setSwipeOffset(0)
  }

  async function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (swipeStartXRef.current === null) {
      return
    }

    const deltaX = event.clientX - swipeStartXRef.current
    swipeStartXRef.current = null
    const shouldToggleClaim = deltaX <= -72
    isSwipingRef.current = false
    setSwipeOffset(0)

    if (shouldToggleClaim) {
      await onToggleClaim(item)
    }
  }

  return (
    <article
      className={`checklist-row checklist-row--minimal checklist-row--claimable ${item.claimedByDisplayName ? 'is-claimed' : ''}`}
      style={{
        ...(claimStyle ?? {}),
        transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerUp={(event) => void handlePointerUp(event)}
    >
      <button
        aria-label={item.checked ? `Avmarkera ${item.title}` : `Markera ${item.title}`}
        className={`square-check ${item.checked ? 'is-checked' : ''}`}
        disabled={isBusy}
        onClick={() => void onToggleCheck(item)}
        type="button"
      >
        {item.checked ? '✓' : ''}
      </button>
      <div className="catalog-row__media">{renderItemMedia(item)}</div>
      <div className="catalog-row__content">
        <strong>{item.title}</strong>
        {itemSubtitle(item) ? <p>{itemSubtitle(item)}</p> : null}
        {claimDisplayName ? <p className="claim-label">{claimDisplayName} hämtar</p> : null}
      </div>
      <div className="catalog-row__aside">
        <span className="checklist-quantity">{formatQuantity(item.quantity)}</span>
      </div>
    </article>
  )
}

function renderItemMedia(item: ShoppingListItem) {
  if (item.externalSnapshot?.imageUrl) {
    return <img alt="" src={item.externalSnapshot.imageUrl} />
  }

  return <span>TXT</span>
}
