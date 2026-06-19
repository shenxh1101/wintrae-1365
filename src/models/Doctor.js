import mongoose from 'mongoose';

const { Schema } = mongoose;

const doctorSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

doctorSchema.index({ department: 1 });
doctorSchema.index({ status: 1 });

const Doctor = mongoose.model('Doctor', doctorSchema);

export default Doctor;
