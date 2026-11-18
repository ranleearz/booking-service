import { useState } from 'react'
import { Button, controlClass } from './Button'

export function CancelAction({
  canCancel,
  pending,
  onConfirm,
}: {
  canCancel: boolean
  pending: boolean
  onConfirm: (reason: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!canCancel) return null
  if (!open) {
    return <Button tone="ghost" className="mt-3" onClick={() => setOpen(true)}>Отменить</Button>
  }
  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        onConfirm(reason.trim())
      }}
    >
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Причина, если нужна"
        maxLength={500}
        className={controlClass}
      />
      <Button type="submit" tone="danger" disabled={pending}>
        {pending ? 'Отменяем…' : 'Подтвердить отмену'}
      </Button>
      <Button tone="ghost" onClick={() => setOpen(false)}>Назад</Button>
    </form>
  )
}
