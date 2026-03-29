import { ChecklistItemRow } from './ChecklistItemRow'
import { claimActionKey, formatQuantity, itemSubtitle, type ItemGroup } from './detailPageUtils'
import type { ShoppingListItem } from '../../../shared/types/api'

interface ChecklistPanelProps {
  checkedChecklistItems: ShoppingListItem[]
  checkedCount: number
  pendingActionKey: string | null
  totalQuantity: number
  uncheckedChecklistGroups: ItemGroup[]
  onToggleCheck: (item: ShoppingListItem) => Promise<void>
  onToggleClaim: (item: ShoppingListItem) => Promise<void>
}

export function ChecklistPanel({
  checkedChecklistItems,
  checkedCount,
  pendingActionKey,
  totalQuantity,
  uncheckedChecklistGroups,
  onToggleCheck,
  onToggleClaim,
}: ChecklistPanelProps) {
  return (
    <section className="checklist-screen">
      <div className="checklist-summary">
        <strong>
          {checkedCount} av {totalQuantity} klara
        </strong>
      </div>

      {totalQuantity === 0 ? (
        <section className="checklist-section">
          <p className="empty-state">Inga rader att pricka av än. Lägg till varor i sökvyn först.</p>
        </section>
      ) : null}

      {uncheckedChecklistGroups.map((group) => (
        <section className="checklist-section" key={group.title}>
          <h2 className="checklist-section__title">{group.title}</h2>
          <div className="checklist-list">
            {group.items.map((item) => (
              <ChecklistItemRow
                isBusy={pendingActionKey === item.id || pendingActionKey === claimActionKey(item.id)}
                item={item}
                key={item.id}
                onToggleCheck={onToggleCheck}
                onToggleClaim={onToggleClaim}
              />
            ))}
          </div>
        </section>
      ))}

      {checkedChecklistItems.length > 0 ? (
        <section className="checklist-section checklist-section--checked">
          <h2 className="checklist-section__title">Avprickade varor</h2>
          <div className="checklist-list">
            {checkedChecklistItems.map((item) => (
              <article className="checklist-row checklist-row--minimal is-checked" key={item.id}>
                <button
                  aria-label={`Avmarkera ${item.title}`}
                  className="square-check is-checked"
                  disabled={pendingActionKey === item.id}
                  onClick={() => void onToggleCheck(item)}
                  type="button"
                >
                  ✓
                </button>
                <div className="catalog-row__media">{renderItemMedia(item)}</div>
                <div className="catalog-row__content">
                  <strong>{item.title}</strong>
                  {itemSubtitle(item) ? <p>{itemSubtitle(item)}</p> : null}
                </div>
                <div className="catalog-row__aside">
                  <span className="checklist-quantity">{formatQuantity(item.quantity)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  )
}

function renderItemMedia(item: ShoppingListItem) {
  if (item.externalSnapshot?.imageUrl) {
    return <img alt="" src={item.externalSnapshot.imageUrl} />
  }

  return <span>TXT</span>
}
