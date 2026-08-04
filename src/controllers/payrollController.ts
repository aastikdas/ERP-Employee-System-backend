import { Response } from 'express';
import { prisma } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

export const generatePayroll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.body;
    const userId = req.user?.userId;

    if (!month || !year) {
      res.status(400).json({ message: 'Month and year are required.' });
      return;
    }

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const m = parseInt(month);
    const y = parseInt(year);

    if (isNaN(m) || m < 1 || m > 12 || isNaN(y)) {
      res.status(400).json({ message: 'Invalid month or year.' });
      return;
    }

    const employees = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
      },
    });

    let generatedCount = 0;
    let skippedCount = 0;

    for (const emp of employees) {
      const existing = await prisma.payroll.findUnique({
        where: {
          employeeId_month_year: {
            employeeId: emp.id,
            month: m,
            year: y,
          },
        },
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      const base = emp.baseSalary;
      const allowances = base * 0.1;
      const deductions = base * 0.05;
      const netSalary = base + allowances - deductions;

      await prisma.payroll.create({
        data: {
          employeeId: emp.id,
          month: m,
          year: y,
          baseSalary: base,
          allowances,
          deductions,
          netSalary,
          status: 'PENDING',
          processedById: userId,
        },
      });

      generatedCount++;
    }

    res.status(201).json({
      message: `Payroll generation completed. Generated: ${generatedCount}, Skipped (Already existed): ${skippedCount}`,
      generatedCount,
      skippedCount,
    });
  } catch (error) {
    console.error('Generate payroll error:', error);
    res.status(500).json({ message: 'An error occurred during payroll generation.' });
  }
};

export const getPersonalPayroll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const payrolls = await prisma.payroll.findMany({
      where: { employeeId: userId },
      include: {
        processedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    res.status(200).json(payrolls);
  } catch (error) {
    console.error('Get personal payroll error:', error);
    res.status(500).json({ message: 'An error occurred fetching personal payslips.' });
  }
};

export const getAllPayroll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, employeeId } = req.query;

    const whereClause: any = {};
    if (month) whereClause.month = parseInt(month as string);
    if (year) whereClause.year = parseInt(year as string);
    if (employeeId) whereClause.employeeId = parseInt(employeeId as string);

    const payrolls = await prisma.payroll.findMany({
      where: whereClause,
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
        processedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    res.status(200).json(payrolls);
  } catch (error) {
    console.error('Get all payroll error:', error);
    res.status(500).json({ message: 'An error occurred fetching payroll records.' });
  }
};

export const updatePayrollStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const payrollId = parseInt(id as string);

    if (isNaN(payrollId)) {
      res.status(400).json({ message: 'Invalid payroll ID.' });
      return;
    }

    const { status } = req.body;
    if (status !== 'PAID' && status !== 'PENDING') {
      res.status(400).json({ message: 'Status must be PAID or PENDING.' });
      return;
    }

    const updated = await prisma.payroll.update({
      where: { id: payrollId },
      data: {
        status,
        paymentDate: status === 'PAID' ? new Date() : null,
      },
    });

    res.status(200).json({
      message: `Payroll status updated to ${status.toLowerCase()}.`,
      payroll: updated,
    });
  } catch (error) {
    console.error('Update payroll status error:', error);
    res.status(500).json({ message: 'An error occurred updating the payroll status.' });
  }
};
