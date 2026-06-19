import mongoose from 'mongoose';

const { Schema } = mongoose;

const scheduleSchema = new Schema({
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
  type: {
    type: String,
    enum: ['regular', 'temporary'],
    default: 'regular'
  },
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  },
  totalSlots: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

scheduleSchema.index({ doctorId: 1, date: 1 }, { unique: true });

const Schedule = mongoose.model('Schedule', scheduleSchema);

export default Schedule;
