/**
 * Tìm working hour/shift phù hợp cho một thời điểm và action cụ thể
 * 
 * Logic:
 * - Entry: Tìm ca có startTime gần nhất và phù hợp (đang trong ca hoặc sắp bắt đầu)
 * - Exit: Tìm ca có endTime gần nhất và phù hợp (đang trong ca hoặc vừa kết thúc)
 * 
 * @param {Date} dateTime - Thời điểm cần kiểm tra
 * @param {string} action - 'entry' hoặc 'exit'
 * @param {Array} workingHoursList - Danh sách các working hours active
 * @returns {Object|null} Working hour phù hợp hoặc null nếu ngoài giờ làm việc
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
    return null; // Không phải ngày làm việc
  }

  // Helper function để so sánh thời gian (HH:mm)
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const currentMinutes = timeToMinutes(timeStr);

  if (action === 'entry') {
    // Entry: Tìm ca phù hợp khi vào
    // 1. Ưu tiên ca đang trong giờ: startTime <= timeStr <= endTime
    // 2. Hoặc ca sắp bắt đầu (trong tolerance)
    
    let bestMatch = null;
    let smallestDiff = Infinity;

    for (const wh of applicableWH) {
      const startMinutes = timeToMinutes(wh.startTime);
      const endMinutes = timeToMinutes(wh.endTime);
      const tolerance = wh.lateToleranceMinutes || 30;
      
      // Phát hiện overnight shift (ca qua đêm)
      const isOvernightShift = endMinutes < startMinutes;

      // Kiểm tra xem có trong ca không (bao gồm tolerance)
      let isInShift;
      if (isOvernightShift) {
        // Ca qua đêm: nằm trong ca nếu >= startTime HOẶC <= endTime
        isInShift = currentMinutes >= (startMinutes - tolerance) || 
                    currentMinutes <= endMinutes;
      } else {
        // Ca thường: nằm trong ca nếu >= startTime VÀ <= endTime
        isInShift = currentMinutes >= (startMinutes - tolerance) && 
                    currentMinutes <= endMinutes;
      }

      if (isInShift) {
        // Tính khoảng cách đến điểm bắt đầu ca
        let diff;
        if (isOvernightShift) {
          // Với ca qua đêm, tính khoảng cách có xét đến việc qua ngày
          if (currentMinutes >= startMinutes) {
            diff = currentMinutes - startMinutes;
          } else {
            // Qua đêm: tính từ startTime đến 24:00 + từ 00:00 đến currentTime
            diff = (1440 - startMinutes) + currentMinutes;
          }
        } else {
          diff = Math.abs(currentMinutes - startMinutes);
        }
        
        // Chọn ca có startTime gần nhất
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestMatch = wh;
        }
      }
    }

    return bestMatch;

  } else if (action === 'exit') {
    // Exit: Tìm ca phù hợp khi ra
    // 1. Ưu tiên ca đang trong giờ: startTime <= timeStr <= endTime
    // 2. Hoặc ca vừa kết thúc (trong tolerance - có thể ra muộn)
    
    let bestMatch = null;
    let smallestDiff = Infinity;

    for (const wh of applicableWH) {
      const startMinutes = timeToMinutes(wh.startTime);
      const endMinutes = timeToMinutes(wh.endTime);
      const tolerance = wh.earlyToleranceMinutes || 30;
      
      // Phát hiện overnight shift (ca qua đêm)
      const isOvernightShift = endMinutes < startMinutes;

      // Kiểm tra xem có trong ca không (bao gồm tolerance và có thể ra sau endTime)
      let isInShift;
      if (isOvernightShift) {
        // Ca qua đêm: nằm trong ca nếu >= startTime HOẶC <= endTime + tolerance
        isInShift = currentMinutes >= startMinutes || 
                    currentMinutes <= (endMinutes + tolerance * 2);
      } else {
        // Ca thường: nằm trong ca nếu >= startTime VÀ <= endTime + tolerance
        isInShift = currentMinutes >= startMinutes && 
                    currentMinutes <= (endMinutes + tolerance * 2);
      }

      if (isInShift) {
        // Tính khoảng cách đến điểm kết thúc ca
        let diff;
        if (isOvernightShift) {
          // Với ca qua đêm, tính khoảng cách có xét đến việc qua ngày
          if (currentMinutes <= endMinutes) {
            diff = Math.abs(currentMinutes - endMinutes);
          } else {
            // Từ currentTime đến 24:00 + từ 00:00 đến endTime
            diff = (1440 - currentMinutes) + endMinutes;
          }
        } else {
          diff = Math.abs(currentMinutes - endMinutes);
        }
        
        // Chọn ca có endTime gần nhất
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestMatch = wh;
        }
      }
    }

    return bestMatch;
  }

  return null;
}

/**
 * Kiểm tra vi phạm cho một access log với shift-based logic
 * 
 * @param {Object} log - Access log object
 * @param {Array} workingHoursList - Danh sách working hours
 * @returns {Object} Kết quả kiểm tra vi phạm
 */
export function checkViolationWithShift(log, workingHoursList) {
  const relevantWH = findRelevantWorkingHour(log.createdAt, log.action, workingHoursList);

  const result = {
    relevantWorkingHour: relevantWH ? {
      id: relevantWH._id,
      name: relevantWH.name,
      startTime: relevantWH.startTime,
      endTime: relevantWH.endTime
    } : null,
    status: 'outside_hours',
    isViolation: false,
    violationMinutes: 0,
    reason: null
  };

  if (!relevantWH) {
    result.reason = 'Ngoài giờ làm việc';
    return result;
  }

  // Kiểm tra có approved request không
  const hasApprovedRequest = log.metadata?.workingHoursRequest?.requestId;

  if (log.action === 'entry') {
    const lateCheck = relevantWH.isLate(log.createdAt);
    result.lateCheck = lateCheck;
    
    if (lateCheck.isLate && !hasApprovedRequest) {
      result.status = 'late';
      result.isViolation = true;
      result.violationMinutes = lateCheck.lateMinutes;
      result.reason = `Đi muộn ${lateCheck.lateMinutes} phút so với ca ${relevantWH.name}`;
    } else {
      result.status = 'ontime';
      result.reason = hasApprovedRequest ? 'Có yêu cầu được phê duyệt' : 'Đúng giờ';
    }

  } else if (log.action === 'exit') {
    const earlyCheck = relevantWH.isEarly(log.createdAt);
    result.earlyCheck = earlyCheck;
    
    if (earlyCheck.isEarly && !hasApprovedRequest) {
      result.status = 'early';
      result.isViolation = true;
      result.violationMinutes = earlyCheck.earlyMinutes;
      result.reason = `Về sớm ${earlyCheck.earlyMinutes} phút so với ca ${relevantWH.name}`;
    } else {
      result.status = 'ontime';
      result.reason = hasApprovedRequest ? 'Có yêu cầu được phê duyệt' : 'Đúng giờ';
    }
  }

  return result;
}
