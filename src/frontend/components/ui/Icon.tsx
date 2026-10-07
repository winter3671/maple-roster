export type IconName =
  'home' | 'boss' | 'hunting' | 'ledger' | 'characters' | 'settings' | 'arrow' | 'leaf'

const paths: Record<IconName, string> = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  boss: 'm3 6 4 4 5-6 5 6 4-4-2 12H5L3 6Zm3 15h12',
  hunting: 'M20 4C9 3 3 8 5 15c2 7 13 5 15-11ZM4 21 16 9M9 16v-5m0 5h5',
  ledger: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6',
  characters:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7a4 4 0 0 1 0 7.75',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  leaf: 'M20 4C8 2 3 9 6 16c3 6 13 3 14-12ZM4 21 16 9'
}

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
