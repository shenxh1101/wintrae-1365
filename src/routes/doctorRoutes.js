import express from 'express';
import {
  createDoctor,
  getDoctorList,
  getDoctorById,
  updateDoctor,
  deactivateDoctor,
  activateDoctor
} from '../controllers/doctorController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  queryDoctorSchema
} from '../validation/doctorSchema.js';

const router = express.Router();

router.post('/', validateRequest({ body: createDoctorSchema }), createDoctor);
router.get('/', validateRequest({ query: queryDoctorSchema }), getDoctorList);
router.get('/:id', getDoctorById);
router.put('/:id', validateRequest({ body: updateDoctorSchema }), updateDoctor);
router.patch('/:id/deactivate', deactivateDoctor);
router.patch('/:id/activate', activateDoctor);

export default router;
