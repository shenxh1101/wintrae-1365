import Doctor from '../models/Doctor.js';
import { success, fail, HttpCode } from '../utils/response.js';

export const createDoctor = async (req, res) => {
  try {
    const doctor = new Doctor(req.body);
    await doctor.save();
    res.status(HttpCode.SUCCESS).json(success(doctor, '创建成功'));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail('创建失败', HttpCode.INTERNAL_ERROR));
  }
};

export const getDoctorList = async (req, res) => {
  try {
    const { department, status, page = 1, pageSize = 10 } = req.query;
    const filter = {};

    if (department) {
      filter.department = department;
    }
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const [list, total] = await Promise.all([
      Doctor.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Doctor.countDocuments(filter)
    ]);

    res.status(HttpCode.SUCCESS).json(success({
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }, '查询成功'));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail('查询失败', HttpCode.INTERNAL_ERROR));
  }
};

export const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findById(id);

    if (!doctor) {
      return res.status(HttpCode.NOT_FOUND).json(fail('医生不存在', HttpCode.NOT_FOUND));
    }

    res.status(HttpCode.SUCCESS).json(success(doctor, '查询成功'));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail('查询失败', HttpCode.INTERNAL_ERROR));
  }
};

export const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

    if (!doctor) {
      return res.status(HttpCode.NOT_FOUND).json(fail('医生不存在', HttpCode.NOT_FOUND));
    }

    res.status(HttpCode.SUCCESS).json(success(doctor, '更新成功'));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail('更新失败', HttpCode.INTERNAL_ERROR));
  }
};

export const deactivateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });

    if (!doctor) {
      return res.status(HttpCode.NOT_FOUND).json(fail('医生不存在', HttpCode.NOT_FOUND));
    }

    res.status(HttpCode.SUCCESS).json(success(doctor, '停用成功'));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail('停用失败', HttpCode.INTERNAL_ERROR));
  }
};

export const activateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByIdAndUpdate(id, { status: 'active' }, { new: true });

    if (!doctor) {
      return res.status(HttpCode.NOT_FOUND).json(fail('医生不存在', HttpCode.NOT_FOUND));
    }

    res.status(HttpCode.SUCCESS).json(success(doctor, '启用成功'));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail('启用失败', HttpCode.INTERNAL_ERROR));
  }
};
