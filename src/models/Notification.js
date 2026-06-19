import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema({
  appointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['reminder', 'cancelled', 'confirmed'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

notificationSchema.index({ doctorId: 1 });
notificationSchema.index({ patientPhone: 1 });
notificationSchema.index({ read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
