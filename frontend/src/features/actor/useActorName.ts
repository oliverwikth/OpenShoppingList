import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

export function useActorName() {
  const params = useParams()

  return useMemo(() => {
    const actorName = params.actorName?.trim()
    return actorName && actorName.length > 0 ? actorName : 'anna'
  }, [params.actorName])
}
