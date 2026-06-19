import mongoose from 'mongoose';

const { Schema } = mongoose;

const appointmentSchema = new Schema({
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
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  cancelReason: {
    type: String
  },
  noShowReason: {
    type: String
  },
  isRescheduled: {
    type: Boolean,
    default: false
  },
  originalAppointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  }
}, {
  timestamps: true
});

appointmentSchema.index({ doctorId: 1 });
appointmentSchema.index({ patientPhone: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ slotId: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
