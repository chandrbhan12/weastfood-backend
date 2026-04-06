import mongoose from 'mongoose';

const pickupSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pickupPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    items: { type: String, required: true },
    image: { type: String, default: null },
    servings: { type: Number, default: 0 },
    type: { type: String, default: 'other' },
    location: { type: String, default: '' },
    scheduledAt: { type: Date },
    status: {
      type: String,
      enum: ['requested', 'accepted', 'rejected', 'in_transit', 'completed', 'cancelled'],
      default: 'requested',
    },
    notes: { type: String },
    // Tracking fields
    currentLat: { type: Number, default: null },
    currentLng: { type: Number, default: null },
    lastLocationUpdate: { type: Date, default: null },
  },
  { timestamps: true }
);

const PickupRequest = mongoose.model('PickupRequest', pickupSchema);

export default PickupRequest;
