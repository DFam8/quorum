type ToastVariant = 'success' | 'error' | 'info' | 'warning'

type Toast = {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

const toasts = reactive<Toast[]>([])

export function useToast() {
  function show(message: string, variant: ToastVariant = 'info', duration = 4000): void {
    const id = crypto.randomUUID()
    toasts.push({ id, message, variant, duration })
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id: string): void {
    const idx = toasts.findIndex(t => t.id === id)
    if (idx !== -1) toasts.splice(idx, 1)
  }

  return {
    toasts: readonly(toasts),
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    info: (msg: string) => show(msg, 'info'),
    warning: (msg: string) => show(msg, 'warning'),
    dismiss,
  }
}
