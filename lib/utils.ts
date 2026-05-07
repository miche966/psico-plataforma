export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')
  }
  
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  return ''
}
