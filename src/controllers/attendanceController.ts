import { Response } from 'express';
import { prisma } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

const getTodayDate = (): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
};

export const clockIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const today = getTodayDate();
    const now = new Date();

    const existingRecord = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
    });

    if (existingRecord) {
      res.status(400).json({ message: 'You have already clocked in today.' });
      return;
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const isLate = hours > 9 || (hours === 9 && minutes > 30);
    const status = isLate ? 'LATE' : 'PRESENT';

    const attendance = await prisma.attendance.create({
      data: {
        employeeId: userId,
        date: today,
        clockIn: now,
        status,
        remarks: isLate ? 'Clocked in late (after 09:30 AM)' : 'Clocked in on time',
      },
    });

    res.status(201).json({
      message: 'Clock-in successful.',
      attendance,
    });
  } catch (error) {
    console.error('Clock-in error:', error);
    res.status(500).json({ message: 'An error occurred during clock-in.' });
  }
};

export const clockOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const today = getTodayDate();
    const now = new Date();

    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
    });

    if (!attendance) {
      res.status(400).json({ message: 'You must clock in first before clocking out.' });
      return;
    }

    if (attendance.clockOut) {
      res.status(400).json({ message: 'You have already clocked out today.' });
      return;
    }

    let finalStatus = attendance.status;
    const diffMs = now.getTime() - new Date(attendance.clockIn).getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);

    if (diffHrs < 4) {
      finalStatus = 'HALF_DAY';
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        status: finalStatus,
        remarks: diffHrs < 4 
          ? `${attendance.remarks || ''}. Clocked out early (< 4 hrs worked).`.trim()
          : attendance.remarks,
      },
    });

    res.status(200).json({
      message: 'Clock-out successful.',
      attendance: updatedAttendance,
    });
  } catch (error) {
    console.error('Clock-out error:', error);
    res.status(500).json({ message: 'An error occurred during clock-out.' });
  }
};

export const getPersonalHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const history = await prisma.attendance.findMany({
      where: { employeeId: userId },
      orderBy: { date: 'desc' },
    });

    res.status(200).json(history);
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ message: 'An error occurred fetching attendance history.' });
  }
};

export const getTodayAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, employeeId, departmentId } = req.query;

    const whereClause: any = {};

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        // Adjust to include the full end day by parsing or setting to 23:59:59 (since date is stored as midnight UTC)
        const end = new Date(endDate as string);
        end.setUTCHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    } else {
      const today = getTodayDate();
      whereClause.date = today;
    }

    if (employeeId) {
      whereClause.employeeId = parseInt(employeeId as string);
    }

    if (departmentId) {
      whereClause.employee = {
        ...whereClause.employee,
        departmentId: parseInt(departmentId as string),
      };
    }

    const records = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            department: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { clockIn: 'desc' },
      ],
    });
    res.status(200).json(records);
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ message: 'An error occurred fetching today\'s attendance.' });
  }
};

export const getEmployeeAttendanceDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const empId = parseInt(employeeId as string);

    if (isNaN(empId)) {
      res.status(400).json({ message: 'Invalid employee ID.' });
      return;
    }

    const history = await prisma.attendance.findMany({
      where: { employeeId: empId },
      orderBy: { date: 'desc' },
    });

    res.status(200).json(history);
  } catch (error) {
    console.error('Get employee attendance error:', error);
    res.status(500).json({ message: 'An error occurred fetching employee attendance.' });
  }
};

export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const recordId = parseInt(id as string);

    if (isNaN(recordId)) {
      res.status(400).json({ message: 'Invalid record ID.' });
      return;
    }

    const { status, remarks, clockIn, clockOut } = req.body;

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (remarks !== undefined) dataToUpdate.remarks = remarks;
    if (clockIn) dataToUpdate.clockIn = new Date(clockIn);
    if (clockOut) dataToUpdate.clockOut = new Date(clockOut);

    const updated = await prisma.attendance.update({
      where: { id: recordId },
      data: dataToUpdate,
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'An error occurred updating attendance.' });
  }
};
