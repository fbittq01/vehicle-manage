import { departmentFilterMiddleware } from '../utils/departmentFilter.js';

/**
 * Middleware configs cho từng loại resource
 */
export const departmentFilterConfigs = {
  // Users - user chỉ xem thông tin của mình, admin xem users cùng department
  users: departmentFilterMiddleware({
    ownerField: '_id',
    departmentField: 'department',
    allowSelfOnly: true
  }),

  // Vehicles - user chỉ xem xe của mình, admin xem xe của users cùng department
  vehicles: departmentFilterMiddleware({
    ownerField: 'owner',
    allowSelfOnly: true
  }),

  // Access logs - user chỉ xem logs xe của mình, admin xem logs của users cùng department
  accessLogs: departmentFilterMiddleware({
    ownerField: 'owner',
    allowSelfOnly: true
  }),

  // Cameras - admin và user xem cameras được quản lý bởi users cùng department
  cameras: departmentFilterMiddleware({
    ownerField: 'managedBy',
    allowSelfOnly: false
  }),

  // Working hours - admin và user xem working hours của users cùng department
  workingHours: departmentFilterMiddleware({
    ownerField: 'createdBy',
    allowSelfOnly: false
  })
};

/**
 * Middleware wrapper để dễ dàng áp dụng cho routes
 * @param {String} resourceType - Loại resource (users, vehicles, etc.)
 * @returns {Function} Middleware function
 */
export const withDepartmentFilter = (resourceType) => {
  const middleware = departmentFilterConfigs[resourceType];
  if (!middleware) {
    throw new Error(`Unknown resource type: ${resourceType}`);
  }
  return middleware;
};
