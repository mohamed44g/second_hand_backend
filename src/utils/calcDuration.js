export const calculateDays = (startDate, endDate) => {
  const end = new Date(endDate);
  const timeDiff = end - startDate;
  const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // تحويل الفرق من ميلي ثانية لأيام
  return days >= 0 ? days : 0; // لو الفرق سالب (تاريخ غلط)، نرجع 0
};
