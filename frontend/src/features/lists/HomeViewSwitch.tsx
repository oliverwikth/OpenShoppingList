import { Link } from 'react-router-dom'

interface HomeViewSwitchProps {
  actorName: string
  current: 'lists' | 'stats'
}

export function HomeViewSwitch({ actorName, current }: HomeViewSwitchProps) {
  return (
    <nav aria-label="Hemvyer" className="home-view-switch">
      <Link className={`home-view-switch__item ${current === 'lists' ? 'is-active' : ''}`} to={`/${actorName}`}>
        Alla listor
      </Link>
      <Link className={`home-view-switch__item ${current === 'stats' ? 'is-active' : ''}`} to={`/${actorName}/statistik`}>
        Statistik
      </Link>
    </nav>
  )
}
