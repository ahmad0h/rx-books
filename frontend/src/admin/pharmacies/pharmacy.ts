/** A pharmacy, as returned by /api/pharmacies. */
export interface Pharmacy {
  id: number
  name: string
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  createdAt: string
  updatedAt: string
}

/** What the add / edit form sends. All fields are required. */
export type PharmacyInput = Pick<Pharmacy, 'name' | 'ownerName' | 'ownerPhone' | 'ownerEmail'>

/**
 * TEMPORARY — must match DEFAULT_OWNER_PASSWORD in the backend. New owners can
 * sign in with this until invitations replace it.
 */
export const TEMPORARY_OWNER_PASSWORD = '123456'
