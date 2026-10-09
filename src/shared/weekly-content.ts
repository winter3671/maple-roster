import type { WeeklyContent } from './contracts/weekly.contract'

export function guildContent(
  contents: WeeklyContent[],
  kind: 'suro' | 'flag'
): WeeklyContent | undefined {
  const name = kind === 'suro' ? '[길드]지하수로' : '[길드]플래그레이스'
  return contents.find((content) => content.name.replace(/\s/g, '') === name)
}
