import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Hashed (sha256) opaque refresh token. Plain token is only ever sent over cookies.
    refreshTokenHash: {
      type: String,
      required: true,
      index: true
    },
    // Previously rotated token hashes for replay/reuse detection (ring buffer)
    historyHashes: {
      type: [String],
      default: []
    },
    userAgent: {
      type: String,
      default: '',
      maxlength: 500
    },
    ip: {
      type: String,
      default: ''
    },
    deviceName: {
      type: String,
      default: '',
      maxlength: 200
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastUsedAt: {
      type: Date,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
    },
    revokedReason: {
      type: String,
      enum: ['logout', 'revoked', 'reuse', 'password_changed', 'admin'],
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
)

sessionSchema.index({ user: 1, revokedAt: 1 })
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema)

export default Session
