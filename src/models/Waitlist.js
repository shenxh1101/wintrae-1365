import mongoose from 'mongoose';

const { Schema } = mongoose;

const waitlistSchema = new Schema({
  slotId: {
    type: Schema.Types.ObjectId,
    ref: 'Slot',
    required: true
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  position: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'notification_sent', 'expired', 'confirmed', 'cancelled'],
    default: 'waiting'
  },
  notifiedAt: {
    type: Date
  },
  expiredAt: {
    type: Date
  }
}, {
  timestamps: true
});

waitlistSchema.index({ slotId: 1, status: 1 });
waitlistSchema.index({ doctorId: 1 });
waitlistSchema.index({ patientPhone: 1 });
waitlistSchema.index({ slotId: 1, position: 1 });

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

export default Waitlist;
