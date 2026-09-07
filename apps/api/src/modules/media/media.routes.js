import { Router } from 'express'
import multer from 'multer'

import { env } from '../../config/env.js'
import { requireAuth, requireAdmin } from '../../middlewares/auth.js'
import { BadRequestError } from '../../utils/errors.js'
import { uploadImageHandler } from './media.controller.js'
import { IMAGE_MIME_TYPES } from './media.service.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.mediaMaxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new BadRequestError('Only JPEG, PNG, WebP or GIF images are allowed', 'MEDIA_INVALID_TYPE')
      )
    }
    callback(null, true)
  }
})

const mediaRouter = Router()

mediaRouter.use(requireAuth, requireAdmin())

mediaRouter.post(
  '/images',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError || (err && err.name === 'MulterError')) {
          const message =
            err.code === 'LIMIT_FILE_SIZE'
              ? 'Image exceeds the maximum allowed size'
              : 'Image upload failed'
          return next(new BadRequestError(message, 'MEDIA_INVALID_FILE'))
        }
        return next(err)
      }
      next()
    })
  },
  uploadImageHandler
)

export default mediaRouter
