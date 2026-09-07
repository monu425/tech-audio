import Address from './address.model.js'
import { NotFoundError, BadRequestError } from '../../utils/errors.js'

const MAX_ADDRESSES = 20

function toAddressDto(address) {
  const doc = address.toObject ? address.toObject() : address
  return {
    id: doc._id.toString(),
    label: doc.label,
    fullName: doc.fullName,
    line1: doc.line1,
    line2: doc.line2,
    city: doc.city,
    state: doc.state,
    postalCode: doc.postalCode,
    country: doc.country,
    phone: doc.phone,
    isDefault: Boolean(doc.isDefault),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }
}

async function clearDefault(userId, exceptId) {
  const filter = { user: userId, isDefault: true }
  if (exceptId) filter._id = { $ne: exceptId }
  await Address.updateMany(filter, { $set: { isDefault: false } })
}

export async function listAddresses(userId) {
  const addresses = await Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 })
  return { items: addresses.map(toAddressDto) }
}

export async function createAddress(userId, data) {
  const count = await Address.countDocuments({ user: userId })
  if (count >= MAX_ADDRESSES) {
    throw new BadRequestError(
      `You can save up to ${MAX_ADDRESSES} addresses`,
      'ADDRESS_LIMIT_REACHED'
    )
  }
  const isFirst = count === 0
  const isDefault = data.isDefault === true || isFirst
  if (isDefault) await clearDefault(userId)
  const address = await Address.create({
    user: userId,
    label: data.label ?? null,
    fullName: data.fullName,
    line1: data.line1,
    line2: data.line2 ?? null,
    city: data.city,
    state: data.state ?? null,
    postalCode: data.postalCode,
    country: String(data.country).toUpperCase(),
    phone: data.phone ?? null,
    isDefault
  })
  return toAddressDto(address)
}

export async function updateAddress(userId, addressId, data) {
  const address = await Address.findOne({ _id: addressId, user: userId })
  if (!address) throw new NotFoundError('Address not found', 'ADDRESS_NOT_FOUND')
  if (data.isDefault === true) await clearDefault(userId, addressId)
  const fields = [
    'label',
    'fullName',
    'line1',
    'line2',
    'city',
    'state',
    'postalCode',
    'country',
    'phone'
  ]
  for (const field of fields) {
    if (data[field] !== undefined) address[field] = data[field]
  }
  if (address.country) address.country = String(address.country).toUpperCase()
  if (data.isDefault !== undefined) address.isDefault = data.isDefault
  await address.save()
  return toAddressDto(address)
}

export async function deleteAddress(userId, addressId) {
  const address = await Address.findOne({ _id: addressId, user: userId })
  if (!address) throw new NotFoundError('Address not found', 'ADDRESS_NOT_FOUND')
  await Address.deleteOne({ _id: addressId })
  if (address.isDefault) {
    const next = await Address.findOne({ user: userId }).sort({ createdAt: 1 })
    if (next) {
      next.isDefault = true
      await next.save()
    }
  }
  return { deleted: true }
}
