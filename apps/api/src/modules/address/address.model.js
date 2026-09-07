import mongoose from 'mongoose'

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    label: { type: String, trim: true, maxlength: 40, default: null },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200, default: null },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120, default: null },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    country: { type: String, required: true, minlength: 2, maxlength: 2, uppercase: true },
    phone: { type: String, trim: true, maxlength: 40, default: null },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true, versionKey: false }
)

addressSchema.index({ user: 1, isDefault: 1 })

const Address = mongoose.models.Address || mongoose.model('Address', addressSchema)

export default Address
