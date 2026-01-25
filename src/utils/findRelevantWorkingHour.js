/**
 * Tìm working hour vi phạm cho một thời điểm và action cụ thể
 * 
 * Logic: startTime -> endTime là khoảng thời gian CẤM
 * - Entry: Nếu vào TRONG khoảng startTime -> endTime → Vi phạm (đi muộn)
 * - Exit: Nếu ra TRONG khoảng startTime -> endTime → Vi phạm (về sớm)
 * - Nếu NGOÀI khoảng này → Hợp lệ
 * 
 * @param {Date} dateTime - Thời điểm cần kiểm tra
 * @param {string} action - 'entry' hoặc 'exit'
 * @param {Array} workingHoursList - Danh sách các working hours active
 * @returns {Object|null} Working hour bị vi phạm hoặc null nếu hợp lệ
 */
export function findRelevantWorkingHour(dateTime, action, workingHoursList) {
  if (!dateTime || !action || !workingHoursList || workingHoursList.length === 0) {
    return null;
  }

  const dayOfWeek = dateTime.getDay();
  const timeStr = dateTime.toTimeString().substring(0, 5); // HH:mm

  // Lọc working hours áp dụng cho ngày này
  const applicableWH = workingHoursList.filter(wh => 
    wh.workingDays && wh.workingDays.includes(dayOfWeek)
  );

  if (applicableWH.length === 0) {
    return null; // Không có quy định cho ngày này
  }

  // Helper function để so sánh thời gian (HH:mm)
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const currentMinutes = timeToMinutes(timeStr);

  // Tìm working hour bị vi phạm (nếu có)
  for (const wh of applicableWH) {
    const startMinutes = timeToMinutes(wh.startTime);
    const endMinutes = timeToMinutes(wh.endTime);
    
    // Phát hiện overnight shift (ca qua đêm)
    const isOvernightShift = endMinutes < startMinutes;

    // Kiểm tra có nằm trong khoảng CẤM không
    let isInRestrictedPeriod;
    if (isOvernightShift) {
      // Ca qua đêm: trong khoảng cấm nếu >= startTime HOẶC <= endTime
      isInRestrictedPeriod = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    } else {
      // Ca thường: trong khoảng cấm nếu >= startTime VÀ <= endTime
      isInRestrictedPeriod = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }

    // Nếu nằm trong khoảng cấm → Vi phạm
    if (isInRestrictedPeriod) {
      return wh; // Trả về working hour bị vi phạm
    }
  }

  return null; // Không vi phạm bất kỳ working hour nào
}

/**
 * Kiểm tra vi phạm cho một access log với shift-based logic
 * 
 * Logic:
 * - Nếu vào/ra TRONG khoảng startTime -> endTime → Vi phạm
 * - Nếu vào/ra NGOÀI khoảng này → Hợp lệ
 * 
 * @param {Object} log - Access log object
 * @param {Array} workingHoursList - Danh sách working hours
 * @returns {Object} Kết quả kiểm tra vi phạm
 */
export function checkViolationWithShift(log, workingHoursList) {
  const violatedWH = findRelevantWorkingHour(log.createdAt, log.action, workingHoursList);

  const result = {
    relevantWorkingHour: violatedWH ? {
      id: violatedWH._id,
      name: violatedWH.name,
      startTime: violatedWH.startTime,
      endTime: violatedWH.endTime
    } : null,
    status: 'allowed',
    isViolation: false,
    violationMinutes: 0,
    reason: null
  };

  // Nếu không có working hour vi phạm → Hợp lệ
  if (!violatedWH) {
    result.reason = 'Hợp lệ - Ngoài khoảng thời gian cấm';
    return result;
  }

  // Kiểm tra có approved request không
  const hasApprovedRequest = log.metadata?.workingHoursRequest?.requestId;

  if (hasApprovedRequest) {
    result.status = 'approved';
    result.reason = 'Có yêu cầu được phê duyệt';
    return result;
  }

  // Có vi phạm và không có approved request
  if (log.action === 'entry') {
    const lateCheck = violatedWH.isLate(log.createdAt);
    result.lateCheck = lateCheck;
    result.status = 'late';
    result.isViolation = true;
    result.violationMinutes = lateCheck.lateMinutes || 0;
    result.reason = `Vi phạm - Vào trong khoảng thời gian cấm (${violatedWH.startTime} - ${violatedWH.endTime})`;
  } else if (log.action === 'exit') {
    const earlyCheck = violatedWH.isEarly(log.createdAt);
    result.earlyCheck = earlyCheck;
    result.status = 'early';
    result.isViolation = true;
    result.violationMinutes = earlyCheck.earlyMinutes || 0;
    result.reason = `Vi phạm - Ra trong khoảng thời gian cấm (${violatedWH.startTime} - ${violatedWH.endTime})`;
  }

  return result;
}
