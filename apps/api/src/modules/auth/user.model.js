import { UserRoles, UserStatuses } from '@shop/types'
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: Object.values(UserRoles),
      default: UserRoles.CUSTOMER
    },
    status: {
      type: String,
      enum: Object.values(UserStatuses),
      default: UserStatuses.ACTIVE
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    },
    avatarUrl: {
      type: String,
      default: null
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0
    },
    lockedUntil: {
      type: Date,
      default: null
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
)

userSchema.index({ role: 1, status: 1 })

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt
  }
}

const User = mongoose.models.User || mongoose.model('User', userSchema)

export default User
