interface QuantityActionProps {
  count: number
  isPending: boolean
  onDecrease?: (() => void | Promise<void>) | undefined
  onIncrease: () => void | Promise<void>
  title: string
}

export function QuantityAction({ count, isPending, onDecrease, onIncrease, title }: QuantityActionProps) {
  if (count < 1 || !onDecrease) {
    return (
      <button
        aria-label={`Lägg till ${title}`}
        className="circle-action"
        disabled={isPending}
        onClick={() => void onIncrease()}
        type="button"
      >
        {isPending ? '...' : '+'}
      </button>
    )
  }

  return (
    <div className="quantity-stepper" role="group" aria-label={`Antal för ${title}`}>
      <button
        aria-label={`Minska ${title}`}
        className="quantity-stepper__button"
        disabled={isPending}
        onClick={() => void onDecrease()}
        type="button"
      >
        -
      </button>
      <span className="quantity-stepper__count">{count}</span>
      <button
        aria-label={`Öka ${title}`}
        className="quantity-stepper__button"
        disabled={isPending}
        onClick={() => void onIncrease()}
        type="button"
      >
        +
      </button>
    </div>
  )
}
