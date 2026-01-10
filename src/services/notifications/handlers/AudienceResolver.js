import { User, Department } from '../../../models/index.js';

/**
 * AudienceResolver - Xử lý logic tìm recipients cho notification
 * Tập trung tất cả logic phân quyền ở một nơi
 */
export class AudienceResolver {
  
  /**
   * Resolve recipients dựa trên audience type và context
   * @param {string} audienceType - Loại audience (supervisors, department_admins, etc.)
   * @param {Object} context - Context data (userId, departmentId, etc.) 
   * @returns {Array} Danh sách user IDs
   */
  static async resolve(audienceType, context = {}) {
    switch (audienceType) {
      case 'supervisors':
        return this.getSupervisors();
        
      case 'department_admins':
        return this.getDepartmentAdmins(context.departmentId);
        
      case 'requester':
        return context.requesterId ? [{ _id: context.requesterId }] : [];
        
      case 'vehicle_owner':
        return context.ownerId ? [{ _id: context.ownerId }] : [];
        
      case 'specific_user':
        return context.userId ? [{ _id: context.userId }] : [];
        
      default:
        console.warn(`Unknown audience type: ${audienceType}`);
        return [];
    }
  }

  /**
   * Lấy tất cả supervisors active
   * @returns {Array} Danh sách supervisors
   */
  static async getSupervisors() {
    try {
      return await User.find({ 
        role: 'supervisor', 
        isActive: true 
      }).select('_id name username');
    } catch (error) {
      console.error('Error getting supervisors:', error);
      return [];
    }
  }

  /**
   * Lấy tất cả admin trong department và department cha
   * @param {string} departmentId - ID của department
   * @returns {Array} Danh sách admin users
   */
  static async getDepartmentAdmins(departmentId) {
    if (!departmentId) return [];

    try {
      return await this.findDepartmentAdminsRecursive(departmentId);
    } catch (error) {
      console.error('Error getting department admins:', error);
      return [];
    }
  }

  /**
   * Đệ quy tìm admin trong department và department cha
   * @param {string} departmentId - ID của department  
   * @returns {Array} Danh sách admin users
   */
  static async findDepartmentAdminsRecursive(departmentId) {
    const adminUsers = [];
    
    try {
      // Tìm department hiện tại
      const department = await Department.findById(departmentId)
        .populate('manager', '_id name username role')
        .populate('parentDepartment');

      if (!department) return adminUsers;

      // Thêm manager của department hiện tại nếu là admin
      if (department.manager && department.manager.role === 'admin') {
        adminUsers.push(department.manager);
      }

      // Tìm tất cả admin trong department hiện tại
      const departmentAdmins = await User.find({
        department: departmentId,
        role: 'admin',
        isActive: true
      }).select('_id name username role');

      adminUsers.push(...departmentAdmins);

      // Đệ quy tìm admin trong department cha
      if (department.parentDepartment) {
        const parentAdmins = await this.findDepartmentAdminsRecursive(department.parentDepartment._id);
        adminUsers.push(...parentAdmins);
      }

      // Loại bỏ trùng lặp
      const uniqueAdmins = adminUsers.filter((admin, index, self) => 
        index === self.findIndex(a => a._id.toString() === admin._id.toString())
      );

      return uniqueAdmins;

    } catch (error) {
      console.error('Error in findDepartmentAdminsRecursive:', error);
      return adminUsers;
    }
  }

  /**
   * Lấy socket rooms tương ứng với audience type
   * @param {string} audienceType - Loại audience
   * @param {Object} context - Context data
   * @returns {Array} Danh sách room names
   */
  static getSocketRooms(audienceType, context = {}) {
    const rooms = [];

    switch (audienceType) {
      case 'supervisors':
        rooms.push('role_supervisor');
        break;
        
      case 'department_admins':
        if (context.departmentId) {
          rooms.push(`department_${context.departmentId}`);
        }
        break;
        
      case 'requester':
      case 'vehicle_owner':
      case 'specific_user':
        const userId = context.requesterId || context.ownerId || context.userId;
        if (userId) {
          rooms.push(`user_${userId}`);
        }
        break;
    }

    return rooms;
  }

  /**
   * Validate context data theo audience type
   * @param {string} audienceType - Loại audience  
   * @param {Object} context - Context data
   * @returns {boolean} Valid hay không
   */
  static validateContext(audienceType, context = {}) {
    switch (audienceType) {
      case 'supervisors':
        return true; // Không cần context
        
      case 'department_admins':
        return !!context.departmentId;
        
      case 'requester':
        return !!context.requesterId;
        
      case 'vehicle_owner':
        return !!context.ownerId;
        
      case 'specific_user':
        return !!context.userId;
        
      default:
        return false;
    }
  }
}
