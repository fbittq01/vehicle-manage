import { Department } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';

// Lấy danh sách tất cả phòng ban
export const getDepartments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { isActive, search, level, managerId, parentId } = req.query;

  // Build query filter
  const filter = {};
  
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (managerId) filter.manager = managerId;
  if (parentId) filter.parentDepartment = parentId;
  
  // Filter theo level (0 = root departments, 1+ = sub departments)
  if (level !== undefined) {
    if (level === '0') {
      filter.parentDepartment = { $exists: false };
    } else {
      filter.parentDepartment = { $exists: true };
    }
  }
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query
  const [departments, total] = await Promise.all([
    Department.find(filter)
      .populate('manager', 'name username')
      .populate('parentDepartment', 'name code')
      .populate('createdBy', 'name username')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    Department.countDocuments(filter)
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, departments, pagination, 'Lấy danh sách phòng ban thành công');
});

// Lấy thông tin phòng ban theo ID
export const getDepartmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const department = await Department.findById(id)
    .populate('manager', 'name username phone')
    .populate('parentDepartment', 'name code')
    .populate('createdBy', 'name username')
    .populate('subDepartments');
  
  if (!department) {
    return sendErrorResponse(res, 'Không tìm thấy phòng ban', 404);
  }

  sendSuccessResponse(res, { department }, 'Lấy thông tin phòng ban thành công');
});

// Tạo phòng ban mới
export const createDepartment = asyncHandler(async (req, res) => {
  const departmentData = {
    ...req.body,
    createdBy: req.user.id
  };

  // Kiểm tra mã phòng ban đã tồn tại chưa
  const existingDepartment = await Department.findOne({ code: departmentData.code });
  if (existingDepartment) {
    return sendErrorResponse(res, 'Mã phòng ban đã tồn tại', 400);
  }

  // Kiểm tra tên phòng ban đã tồn tại chưa
  const existingName = await Department.findOne({ name: departmentData.name });
  if (existingName) {
    return sendErrorResponse(res, 'Tên phòng ban đã tồn tại', 400);
  }

  // Kiểm tra parent department có tồn tại không
  if (departmentData.parentDepartment) {
    const parentDept = await Department.findById(departmentData.parentDepartment);
    if (!parentDept) {
      return sendErrorResponse(res, 'Phòng ban cha không tồn tại', 400);
    }
    if (!parentDept.isActive) {
      return sendErrorResponse(res, 'Phòng ban cha không còn hoạt động', 400);
    }
  }

  const department = new Department(departmentData);
  await department.save();

  // Populate thông tin sau khi tạo
  await department.populate('manager', 'name username');
  await department.populate('parentDepartment', 'name code');
  await department.populate('createdBy', 'name username');

  sendSuccessResponse(res, { department }, 'Tạo phòng ban thành công', 201);
});

// Cập nhật thông tin phòng ban
export const updateDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const department = await Department.findById(id);
  if (!department) {
    return sendErrorResponse(res, 'Không tìm thấy phòng ban', 404);
  }

  // Kiểm tra quyền (chỉ admin hoặc người tạo mới được sửa)
  if (req.user.role !== 'super_admin' && department.createdBy.toString() !== req.user.id) {
    return sendErrorResponse(res, 'Không có quyền cập nhật phòng ban này', 403);
  }

  // Kiểm tra mã phòng ban trùng lặp (nếu thay đổi)
  if (updateData.code && updateData.code !== department.code) {
    const existingCode = await Department.findOne({ 
      code: updateData.code, 
      _id: { $ne: id } 
    });
    if (existingCode) {
      return sendErrorResponse(res, 'Mã phòng ban đã tồn tại', 400);
    }
  }

  // Kiểm tra tên phòng ban trùng lặp (nếu thay đổi)
  if (updateData.name && updateData.name !== department.name) {
    const existingName = await Department.findOne({ 
      name: updateData.name, 
      _id: { $ne: id } 
    });
    if (existingName) {
      return sendErrorResponse(res, 'Tên phòng ban đã tồn tại', 400);
    }
  }

  // Kiểm tra parent department
  if (updateData.parentDepartment) {
    // Không cho phép set chính nó làm parent
    if (updateData.parentDepartment === id) {
      return sendErrorResponse(res, 'Không thể đặt chính phòng ban này làm phòng ban cha', 400);
    }

    const parentDept = await Department.findById(updateData.parentDepartment);
    if (!parentDept) {
      return sendErrorResponse(res, 'Phòng ban cha không tồn tại', 400);
    }
    if (!parentDept.isActive) {
      return sendErrorResponse(res, 'Phòng ban cha không còn hoạt động', 400);
    }
  }

  // Cập nhật thông tin
  Object.assign(department, updateData);
  await department.save();

  // Populate thông tin sau khi cập nhật
  await department.populate('manager', 'name username');
  await department.populate('parentDepartment', 'name code');
  await department.populate('createdBy', 'name username');

  sendSuccessResponse(res, { department }, 'Cập nhật phòng ban thành công');
});

// Xóa phòng ban (soft delete)
export const deleteDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const department = await Department.findById(id);
  if (!department) {
    return sendErrorResponse(res, 'Không tìm thấy phòng ban', 404);
  }

  // Kiểm tra quyền (chỉ admin hoặc người tạo mới được xóa)
  if (req.user.role !== 'super_admin' && department.createdBy.toString() !== req.user.id) {
    return sendErrorResponse(res, 'Không có quyền xóa phòng ban này', 403);
  }

  // Kiểm tra có phòng ban con không
  const subDepartments = await Department.countDocuments({ 
    parentDepartment: id, 
    isActive: true 
  });
  if (subDepartments > 0) {
    return sendErrorResponse(res, 'Không thể xóa phòng ban có phòng ban con', 400);
  }

  // Kiểm tra có nhân viên không (giả sử có model User tham chiếu đến department)
  const { User } = await import('../models/index.js');
  const employees = await User.countDocuments({ 
    department: department.id, 
    isActive: true 
  });
  if (employees > 0) {
    return sendErrorResponse(res, 'Không thể xóa phòng ban còn có nhân viên', 400);
  }

  // Soft delete
  department.isActive = false;
  await department.save();

  sendSuccessResponse(res, null, 'Xóa phòng ban thành công');
});

// Lấy cây phân cấp phòng ban
export const getDepartmentHierarchy = asyncHandler(async (req, res) => {
  // Lấy tất cả phòng ban active
  const departments = await Department.find({ isActive: true })
    .populate('manager', 'name username')
    .sort({ name: 1 });

  // Tạo cây phân cấp
  const departmentMap = {};
  departments.forEach(dept => {
    departmentMap[dept._id] = {
      ...dept.toJSON(),
      children: []
    };
  });

  const rootDepartments = [];
  departments.forEach(dept => {
    if (dept.parentDepartment) {
      const parent = departmentMap[dept.parentDepartment._id];
      if (parent) {
        parent.children.push(departmentMap[dept._id]);
      }
    } else {
      rootDepartments.push(departmentMap[dept._id]);
    }
  });

  sendSuccessResponse(res, { hierarchy: rootDepartments }, 'Lấy cây phân cấp phòng ban thành công');
});

// Lấy phòng ban gốc (root departments)
export const getRootDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.findRootDepartments();
  
  sendSuccessResponse(res, { departments }, 'Lấy danh sách phòng ban gốc thành công');
});

// Lấy phòng ban theo manager
export const getDepartmentsByManager = asyncHandler(async (req, res) => {
  const { managerId } = req.params;
  
  const departments = await Department.findByManager(managerId);
  
  sendSuccessResponse(res, { departments }, 'Lấy danh sách phòng ban theo manager thành công');
});

// Lấy thống kê phòng ban
export const getDepartmentStats = asyncHandler(async (req, res) => {
  const stats = await Department.aggregate([
    {
      $group: {
        _id: null,
        totalDepartments: { $sum: 1 },
        activeDepartments: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        rootDepartments: {
          $sum: { $cond: [{ $eq: ['$parentDepartment', null] }, 1, 0] }
        },
        subDepartments: {
          $sum: { $cond: [{ $ne: ['$parentDepartment', null] }, 1, 0] }
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalDepartments: 0,
    activeDepartments: 0,
    rootDepartments: 0,
    subDepartments: 0
  };

  sendSuccessResponse(res, { stats: result }, 'Lấy thống kê phòng ban thành công');
});
