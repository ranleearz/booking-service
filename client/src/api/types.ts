export type Role = 'client' | 'admin'

export type User = {
  id: string
  email: string
  name: string
  role: Role
}

export type Session = {
  accessToken: string
  user: User
}

export type Service = {
  id: string
  name: string
  description: string
  durationMinutes: number
  priceCents: number
  isActive: boolean
}

export type Specialist = {
  id: string
  name: string
  bio: string
  isActive: boolean
  serviceIds: string[]
}

export type WorkingHour = {
  weekday: number
  startTime: string
  endTime: string
}

export type SpecialistDetail = Specialist & {
  hours: WorkingHour[]
  daysOff: string[]
}

export type Slot = {
  start: string
  end: string
}

export type Booking = {
  id: string
  clientId: string
  clientName: string
  specialistId: string
  specialistName: string
  serviceId: string
  serviceName: string
  durationMinutes: number
  priceCents: number
  startsAt: string
  endsAt: string
  status: 'confirmed' | 'cancelled'
  cancelReason: string | null
  cancelledAt: string | null
  createdAt: string
  canCancel: boolean
}

export type BookingList = {
  items: Booking[]
  total: number
}

export type NotificationItem = {
  id: string
  type: 'booking_created' | 'booking_cancelled'
  title: string
  body: string
  payload: { bookingId?: string }
  readAt: string | null
  createdAt: string
}

export type NotificationList = {
  items: NotificationItem[]
  total: number
  unread: number
}

export type Meta = {
  cancelBeforeHours: number
  timeZone: string
  slotStepMinutes: number
  leadMinutes: number
}
