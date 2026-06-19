import { Router } from 'express';
import { getDepartmentStats, getDoctorStats, getDailyStats, getAbnormalSchedules, getAdminSummary, getScheduleDetail } from '../controllers/statisticsController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { statsQuerySchema, abnormalScheduleSchema, adminSummarySchema } from '../validation/statisticsSchema.js';

const router = Router();

router.get('/department', validateRequest({ query: statsQuerySchema }), getDepartmentStats);
router.get('/doctor', validateRequest({ query: statsQuerySchema }), getDoctorStats);
router.get('/daily', validateRequest({ query: statsQuerySchema }), getDailyStats);
router.get('/abnormal-schedules', validateRequest({ query: abnormalScheduleSchema }), getAbnormalSchedules);
router.get('/admin/summary', validateRequest({ query: adminSummarySchema }), getAdminSummary);
router.get('/schedule/:scheduleId/detail', getScheduleDetail);

export default router;
