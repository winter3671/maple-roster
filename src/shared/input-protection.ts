export type DraftKey = 'income' | 'expense' | 'character' | 'hunting-quick' | 'hunting-detail'

export interface ProtectedInput<Element = unknown> {
  element: Element | null
  dirty: boolean
  busy: boolean
  discard: () => void
}

export class InputProtectionStore<Element = unknown> {
  readonly inputs = new Map<string, ProtectedInput<Element>>()
  private readonly drafts = new Map<DraftKey, { value: unknown; baseline: string }>()

  read<T>(key: DraftKey): { value: T; baseline: string } | undefined {
    return this.drafts.get(key) as { value: T; baseline: string } | undefined
  }

  remember(key: DraftKey, value: unknown, baseline: string): void {
    this.drafts.delete(key)
    this.drafts.set(key, { value: structuredClone(value), baseline })
  }

  forget(key: DraftKey): void {
    this.drafts.delete(key)
  }

  snapshot(scope?: { contains: (element: Element) => boolean } | null, exiting = false) {
    const inputs = [...this.inputs.values()].filter(
      (input) => !scope || (input.element && scope.contains(input.element))
    )
    return {
      busy: inputs.some((input) => input.busy),
      dirty: inputs.some((input) => input.dirty) || (exiting && this.drafts.size > 0)
    }
  }

  discard(scope?: { contains: (element: Element) => boolean } | null, exiting = false): void {
    for (const input of this.inputs.values()) {
      if (!scope || (input.element && scope.contains(input.element))) input.discard()
    }
    if (exiting) this.drafts.clear()
  }
}
