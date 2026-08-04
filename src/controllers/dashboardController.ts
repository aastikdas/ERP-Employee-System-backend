import { Response } from 'express';
import { prisma } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

const getTodayDate = (): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
};

export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const today = getTodayDate();

    if (role === 'ADMIN' || role === 'HR') {
      const totalEmployees = await prisma.user.count({ where: { status: 'ACTIVE' } });
      const totalDepartments = await prisma.department.count();
      const pendingLeaves = await prisma.leave.count({ where: { status: 'PENDING' } });
      const approvedLeaves = await prisma.leave.count({ where: { status: 'APPROVED' } });
      const rejectedLeaves = await prisma.leave.count({ where: { status: 'REJECTED' } });
      
      const presentCount = await prisma.attendance.count({
        where: {
          date: today,
          status: 'PRESENT',
        },
      });

      const lateCount = await prisma.attendance.count({
        where: {
          date: today,
          status: 'LATE',
        },
      });

      const halfDayCount = await prisma.attendance.count({
        where: {
          date: today,
          status: 'HALF_DAY',
        },
      });

      const clockedInCount = presentCount + lateCount + halfDayCount;
      const absentCount = totalEmployees - clockedInCount;

      const attendanceRate = totalEmployees > 0 
        ? Math.round((clockedInCount / totalEmployees) * 100) 
        : 0;

      const lastPayrollMonthYear = await prisma.payroll.findFirst({
        orderBy: [
          { year: 'desc' },
          { month: 'desc' },
        ],
      });

      let lastPayrollCost = 0;
      if (lastPayrollMonthYear) {
        const payrolls = await prisma.payroll.findMany({
          where: {
            month: lastPayrollMonthYear.month,
            year: lastPayrollMonthYear.year,
          },
        });
        lastPayrollCost = payrolls.reduce((sum, p) => sum + p.netSalary, 0);
      }

      const depts = await prisma.department.findMany({
        include: {
          _count: { select: { employees: true } },
        },
      });
      const deptDistribution = depts.map(d => ({
        name: d.name,
        count: d._count.employees,
      }));

      const payrollGroups = await prisma.payroll.groupBy({
        by: ['year', 'month'],
        _sum: { netSalary: true },
        orderBy: [
          { year: 'desc' },
          { month: 'desc' },
        ],
        take: 6,
      });

      const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const payrollTrend = payrollGroups.map(pg => ({
        label: `${monthNames[pg.month]} ${pg.year}`,
        amount: pg._sum.netSalary || 0,
      })).reverse();

      const leaveStats = await prisma.leave.groupBy({
        by: ['status'],
        _count: { id: true },
      });
      const leaveDistribution = leaveStats.map(ls => ({
        status: ls.status,
        count: ls._count.id,
      }));

      res.status(200).json({
        role,
        stats: {
          totalEmployees,
          totalDepartments,
          pendingLeaves,
          approvedLeaves,
          rejectedLeaves,
          attendanceRate,
          lastPayrollCost,
          presentToday: presentCount + halfDayCount,
          lateToday: lateCount,
          absentToday: Math.max(0, absentCount),
        },
        charts: {
          deptDistribution,
          payrollTrend,
          leaveDistribution,
        },
      });
      return;
    }

    if (role === 'MANAGER') {
      const totalSubordinates = await prisma.user.count({ where: { managerId: userId } });
      const pendingLeaves = await prisma.leave.count({
        where: {
          status: 'PENDING',
          employee: { managerId: userId },
        },
      });

      const presentCount = await prisma.attendance.count({
        where: {
          date: today,
          employee: { managerId: userId },
          status: 'PRESENT',
        },
      });

      const lateCount = await prisma.attendance.count({
        where: {
          date: today,
          employee: { managerId: userId },
          status: 'LATE',
        },
      });

      const halfDayCount = await prisma.attendance.count({
        where: {
          date: today,
          employee: { managerId: userId },
          status: 'HALF_DAY',
        },
      });

      const clockedInCount = presentCount + lateCount + halfDayCount;
      const absentCount = totalSubordinates - clockedInCount;

      const attendanceRate = totalSubordinates > 0
        ? Math.round((clockedInCount / totalSubordinates) * 100)
        : 0;

      const myLeaves = await prisma.leave.count({ where: { employeeId: userId } });
      const myClockIns = await prisma.attendance.count({ where: { employeeId: userId, status: { in: ['PRESENT', 'LATE'] } } });

      const teamAttendanceStatus = [
        { name: 'Present', count: presentCount + halfDayCount },
        { name: 'Late', count: lateCount },
        { name: 'Absent', count: Math.max(0, absentCount) },
      ];

      const leaveStats = await prisma.leave.groupBy({
        by: ['status'],
        where: {
          employee: { managerId: userId },
        },
        _count: { id: true },
      });
      const leaveDistribution = leaveStats.map(ls => ({
        status: ls.status,
        count: ls._count.id,
      }));

      res.status(200).json({
        role,
        stats: {
          totalSubordinates,
          pendingLeaves,
          attendanceRate,
          myLeaves,
          myClockIns,
        },
        charts: {
          teamAttendanceStatus,
          leaveDistribution,
        },
      });
      return;
    }

    if (role === 'EMPLOYEE') {
      const pendingLeaves = await prisma.leave.count({ where: { employeeId: userId, status: 'PENDING' } });
      const approvedLeaves = await prisma.leave.count({ where: { employeeId: userId, status: 'APPROVED' } });
      const rejectedLeaves = await prisma.leave.count({ where: { employeeId: userId, status: 'REJECTED' } });
      const totalAttendances = await prisma.attendance.count({
        where: {
          employeeId: userId,
          status: { in: ['PRESENT', 'LATE'] },
        },
      });
      const totalPayslips = await prisma.payroll.count({ where: { employeeId: userId } });

      const todayRecord = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: userId,
            date: today,
          },
        },
      });

      const recentShifts = await prisma.attendance.findMany({
        where: { employeeId: userId },
        orderBy: { date: 'desc' },
        take: 5,
      });

      res.status(200).json({
        role,
        stats: {
          pendingLeaves,
          approvedLeaves,
          rejectedLeaves,
          totalAttendances,
          totalPayslips,
          todayStatus: todayRecord ? todayRecord.status : 'NOT_CLOCKED_IN',
          clockInTime: todayRecord ? todayRecord.clockIn : null,
          clockOutTime: todayRecord ? todayRecord.clockOut : null,
        },
        recentShifts,
      });
    }
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'An error occurred fetching dashboard metrics.' });
  }
};
