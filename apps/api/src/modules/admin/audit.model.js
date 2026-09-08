import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    actorName: { type: String, default: null },
    actorRole: { type: String, default: null },
    action: { type: String, required: true },
    resource: { type: String, default: null },
    resourceId: { type: String, default: null },
    method: { type: String, default: null },
    path: { type: String, default: null },
    status: { type: Number, default: 200 },
    summary: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  { timestamps: true, versionKey: false }
)

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ resource: 1, createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)

export default AuditLog
