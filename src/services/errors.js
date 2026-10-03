export const errorDetails = error => error instanceof Error ? error.message : String(error || 'No technical details were supplied.')

export function operationError(action, error, recovery) {
  return `${action} could not be completed. To fix: ${recovery} Details: ${errorDetails(error)}`
}
