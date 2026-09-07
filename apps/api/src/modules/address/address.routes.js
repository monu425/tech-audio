import { Router } from 'express'
import { z, addressInputSchema } from '@shop/validation'
import { validateBody, validateParams } from '../../middlewares/validate.js'
import { requireAuth } from '../../middlewares/auth.js'
import {
  listAddressesHandler,
  createAddressHandler,
  updateAddressHandler,
  deleteAddressHandler
} from './address.controller.js'

const addressRouter = Router()

const objectIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid address id')
})

const updateAddressSchema = addressInputSchema.partial()

addressRouter.use(requireAuth)

addressRouter.get('/', listAddressesHandler)
addressRouter.post('/', validateBody(addressInputSchema), createAddressHandler)
addressRouter.put(
  '/:id',
  validateParams(objectIdParamSchema),
  validateBody(updateAddressSchema),
  updateAddressHandler
)
addressRouter.delete('/:id', validateParams(objectIdParamSchema), deleteAddressHandler)

export default addressRouter
