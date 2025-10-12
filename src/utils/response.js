// Utility functions cho response API

export const sendSuccessResponse = (res, data = null, message = 'Thành công', statusCode = 200) => {
  const response = {
    success: true,
    message,
    ...(data && { data })
  };
  
  return res.status(statusCode).json(response);
};

export const sendErrorResponse = (res, message = 'Đã có lỗi xảy ra', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    ...(errors && { errors })
  };
  
  return res.status(statusCode).json(response);
};

export const sendPaginatedResponse = (res, data, pagination, message = 'Thành công') => {
  return res.json({
    success: true,
    message,
    data,
    pagination
  });
};

// Utility để tạo pagination
export const createPagination = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null
  };
};

// Utility để format query parameters cho pagination
export const getPaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

// Utility để tạo date với thời gian bắt đầu ngày (00:00:00.000)
export const getStartOfDay = (dateString) => {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Utility để tạo date với thời gian cuối ngày (23:59:59.999)
export const getEndOfDay = (dateString) => {
  const date = new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date;
};
