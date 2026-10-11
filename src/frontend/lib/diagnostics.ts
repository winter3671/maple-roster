import type { RendererIssue } from '../../shared/contracts/diagnostics.contract'

export function reportRendererIssue(kind: RendererIssue) {
  try {
    void window.maple.diagnostics.report(kind).catch(() => {})
  } catch {
    /* No raw error is forwarded. */
  }
}
