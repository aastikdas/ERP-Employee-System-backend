import { Response } from 'express';
import { prisma } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { createNotification } from '../services/notificationService';

export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const { startDate, endDate, type, reason } = req.body;

    if (!startDate || !endDate || !type || !reason) {
      res.status(400).json({ message: 'All fields are required: startDate, endDate, type, reason.' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      res.status(400).json({ message: 'Start date cannot be after end date.' });
      return;
    }

    const leave = await prisma.leave.create({
      data: {
        employeeId: userId,
        startDate: start,
        endDate: end,
        type,
        reason,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      message: 'Leave request submitted successfully.',
      leave,
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'An error occurred submitting the leave request.' });
  }
};

export const getPersonalLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const leaves = await prisma.leave.findMany({
      where: { employeeId: userId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(leaves);
  } catch (error) {
    console.error('Get personal leaves error:', error);
    res.status(500).json({ message: 'An error occurred fetching leave history.' });
  }
};

export const getPendingLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    let leaves;

    if (role === 'ADMIN' || role === 'HR') {
      leaves = await prisma.leave.findMany({
        where: { status: 'PENDING' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (role === 'MANAGER') {
      leaves = await prisma.leave.findMany({
        where: {
          status: 'PENDING',
          employee: {
            managerId: userId,
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }

    res.status(200).json(leaves);
  } catch (error) {
    console.error('Get pending leaves error:', error);
    res.status(500).json({ message: 'An error occurred fetching pending leaves.' });
  }
};

export const getAllLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    let leaves;

    if (role === 'ADMIN' || role === 'HR') {
      leaves = await prisma.leave.findMany({
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { select: { name: true } },
            },
          },
          approvedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (role === 'MANAGER') {
      leaves = await prisma.leave.findMany({
        where: {
          employee: {
            managerId: userId,
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { select: { name: true } },
            },
          },
          approvedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }

    res.status(200).json(leaves);
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({ message: 'An error occurred fetching leaves.' });
  }
};

export const updateLeaveStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const leaveId = parseInt(id as string);
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (isNaN(leaveId)) {
      res.status(400).json({ message: 'Invalid leave ID.' });
      return;
    }

    if (!userId || !role) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const { status } = req.body;
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      res.status(400).json({ message: 'Status must be APPROVED or REJECTED.' });
      return;
    }

    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
      include: {
        employee: true,
      },
    });

    if (!leave) {
      res.status(404).json({ message: 'Leave request not found.' });
      return;
    }

    if (leave.status !== 'PENDING') {
      res.status(400).json({ message: `Leave request has already been ${leave.status.toLowerCase()}.` });
      return;
    }

    if (role === 'MANAGER') {
      if (leave.employee.managerId !== userId) {
        res.status(403).json({ message: 'You can only approve leaves for your direct reports.' });
        return;
      }
    } else if (role !== 'ADMIN' && role !== 'HR') {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }

    const updatedLeave = await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status,
        approvedById: userId,
      },
    });

    // Send notifications to employee
    const statusLabel = status === 'APPROVED' ? 'Approved' : 'Rejected';
    await createNotification(
      leave.employeeId,
      `Leave Request ${statusLabel}`,
      `Your ${leave.type.toLowerCase()} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been ${status.toLowerCase()}.`
    );

    res.status(200).json({
      message: `Leave request has been ${status.toLowerCase()} successfully.`,
      leave: updatedLeave,
    });
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({ message: 'An error occurred updating the leave status.' });
  }
};

export const cancelLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const leave = await prisma.leave.findUnique({
      where: { id: parseInt(id as string) },
    });

    if (!leave) {
      res.status(404).json({ message: 'Leave request not found.' });
      return;
    }

    if (leave.employeeId !== userId && role !== 'ADMIN' && role !== 'HR') {
      res.status(403).json({ message: 'You are not authorized to cancel this request.' });
      return;
    }

    if (leave.status !== 'PENDING') {
      res.status(400).json({ message: 'Only pending leave requests can be cancelled.' });
      return;
    }

    await prisma.leave.delete({
      where: { id: parseInt(id as string) },
    });

    res.status(200).json({ message: 'Leave request cancelled successfully.' });
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ message: 'An error occurred cancelling leave request.' });
  }
};
