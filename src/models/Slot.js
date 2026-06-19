import mongoose from 'mongoose';

const { Schema } = mongoose;

const slotSchema = new Schema({
  scheduleId: {
    type: Schema.Types.ObjectId,
    ref: 'Schedule',
    required: true
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'locked', 'booked', 'cancelled'],
    default: 'available'
  },
  patientName: {
    type: String
  },
  patientPhone: {
    type: String
  },
  lockedAt: {
    type: Date
  },
  appointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  }
});

slotSchema.index({ scheduleId: 1 });
slotSchema.index({ doctorId: 1, date: 1 });
slotSchema.index({ status: 1 });

const Slot = mongoose.model('Slot', slotSchema);

export default Slot;
