// Example: Cách sử dụng department filter middleware trong routes

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { withDepartmentFilter } from '../middleware/departmentFilterConfigs.js';
import { applyDepartmentFilter } from '../utils/departmentFilter.js';

const router = express.Router();

// Cách 1: Sử dụng middleware tự động
router.get('/users', 
  authenticateToken,
  withDepartmentFilter('users'), // Tự động tạo req.departmentFilter
  (req, res) => {
    // Trong controller có thể sử dụng applyDepartmentFilter(req, baseFilter)
  }
);

// Cách 2: Sử dụng trong controller trực tiếp (như đã làm)
router.get('/vehicles', 
  authenticateToken,
  async (req, res) => {
    try {
      const departmentFilter = await createDepartmentFilter(req.user, {
        ownerField: 'owner',
        allowSelfOnly: true
      });
      
      const filter = { ...baseFilter, ...departmentFilter };
      // ... tiếp tục logic
    } catch (error) {
      // Handle error
    }
  }
);

export default router;
