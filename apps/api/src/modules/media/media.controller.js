import { sendSuccess } from '../../utils/respond.js'
import { BadRequestError } from '../../utils/errors.js'
import { storeImageFile } from './media.service.js'

export async function uploadImageHandler(req, res, next) {
  try {
    if (!req.file) {
      throw new BadRequestError('No image file was provided', 'MEDIA_FILE_REQUIRED')
    }
    const data = await storeImageFile(req.file)
    return sendSuccess(res, { message: 'Image uploaded', data })
  } catch (err) {
    next(err)
  }
}
