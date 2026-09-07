import mongoose from 'mongoose'

const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, versionKey: false }
)

const PlatformSetting =
  mongoose.models.PlatformSetting || mongoose.model('PlatformSetting', platformSettingSchema)

export default PlatformSetting
