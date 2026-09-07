import { sendSuccess, sendCreated } from '../../utils/respond.js'
import { listAddresses, createAddress, updateAddress, deleteAddress } from './address.service.js'

export async function listAddressesHandler(req, res, next) {
  try {
    const data = await listAddresses(req.user._id)
    return sendSuccess(res, { message: 'Addresses fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function createAddressHandler(req, res, next) {
  try {
    const data = await createAddress(req.user._id, req.body)
    return sendCreated(res, { message: 'Address saved', data })
  } catch (err) {
    next(err)
  }
}

export async function updateAddressHandler(req, res, next) {
  try {
    const data = await updateAddress(req.user._id, req.params.id, req.body)
    return sendSuccess(res, { message: 'Address updated', data })
  } catch (err) {
    next(err)
  }
}

export async function deleteAddressHandler(req, res, next) {
  try {
    await deleteAddress(req.user._id, req.params.id)
    return sendSuccess(res, { message: 'Address deleted', data: { deleted: true } })
  } catch (err) {
    next(err)
  }
}
