import { Response } from 'express';
import { prisma } from '../services/db';
import { hashPassword } from '../utils/hash';
import { AuthRequest } from '../middlewares/authMiddleware';
import { createNotification } from '../services/notificationService';

export const getEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isHrOrAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'HR';
    const isManager = req.user?.role === 'MANAGER';

    if (isHrOrAdmin || isManager) {
      const employees = await prisma.user.findMany({
        include: {
          department: true,
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).json(employees);
      return;
    }

    const employees = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: {
          select: {
            name: true,
            code: true,
          },
        },
        manager: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });
    res.status(200).json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'An error occurred fetching employees.' });
  }
};

export const getEmployeeById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empId = parseInt(id as string);

    if (isNaN(empId)) {
      res.status(400).json({ message: 'Invalid employee ID.' });
      return;
    }

    const isHrOrAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'HR';
    const isSelf = req.user?.userId === empId;

    const employee = await prisma.user.findUnique({
      where: { id: empId },
      include: {
        department: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ message: 'Employee not found.' });
      return;
    }

    if (!isHrOrAdmin && !isSelf) {
      const { password: _, baseSalary: __, ...basicInfo } = employee;
      res.status(200).json(basicInfo);
      return;
    }

    const { password: _, ...employeeWithoutPassword } = employee;
    res.status(200).json(employeeWithoutPassword);
  } catch (error) {
    console.error('Get employee detail error:', error);
    res.status(500).json({ message: 'An error occurred fetching employee details.' });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      address,
      dob,
      dateOfJoining,
      role,
      status,
      baseSalary,
      departmentId,
      managerId,
    } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ message: 'Email, password, firstName, and lastName are required.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ message: 'An employee with this email already exists.' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const employee = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        address,
        dob: dob ? new Date(dob) : null,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
        role: role || 'EMPLOYEE',
        status: status || 'ACTIVE',
        baseSalary: baseSalary ? parseFloat(baseSalary) : 0.0,
        departmentId: departmentId ? parseInt(departmentId) : null,
        managerId: managerId ? parseInt(managerId) : null,
      },
    });

    const { password: _, ...employeeWithoutPassword } = employee;

    await createNotification(
      employee.id,
      "Welcome to Enterprise ERP!",
      `Hello ${employee.firstName}, your corporate ERP account has been successfully created. Welcome aboard!`
    );

    res.status(201).json(employeeWithoutPassword);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'An error occurred creating the employee.' });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empId = parseInt(id as string);

    if (isNaN(empId)) {
      res.status(400).json({ message: 'Invalid employee ID.' });
      return;
    }

    const isHrOrAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'HR';
    const isSelf = req.user?.userId === empId;

    if (!isHrOrAdmin && !isSelf) {
      res.status(403).json({ message: 'Access denied. You can only edit your own details.' });
      return;
    }

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      address,
      dob,
      dateOfJoining,
      role,
      status,
      baseSalary,
      departmentId,
      managerId,
    } = req.body;

    const dataToUpdate: any = {};

    if (firstName) dataToUpdate.firstName = firstName;
    if (lastName) dataToUpdate.lastName = lastName;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (address !== undefined) dataToUpdate.address = address;
    if (dob) dataToUpdate.dob = new Date(dob);

    if (password) {
      dataToUpdate.password = await hashPassword(password);
    }

    if (isHrOrAdmin) {
      if (email) dataToUpdate.email = email;
      if (role) dataToUpdate.role = role;
      if (status) dataToUpdate.status = status;
      if (baseSalary !== undefined) dataToUpdate.baseSalary = parseFloat(baseSalary);
      if (departmentId !== undefined) dataToUpdate.departmentId = departmentId ? parseInt(departmentId) : null;
      if (managerId !== undefined) dataToUpdate.managerId = managerId ? parseInt(managerId) : null;
      if (dateOfJoining) dataToUpdate.dateOfJoining = new Date(dateOfJoining);
    }

    const updatedEmployee = await prisma.user.update({
      where: { id: empId },
      data: dataToUpdate,
    });

    if (password) {
      await createNotification(
        updatedEmployee.id,
        "Password Changed",
        "Your account password was successfully changed. If you did not make this change, please contact IT support immediately."
      );
    }

    const { password: _, ...employeeWithoutPassword } = updatedEmployee;
    res.status(200).json(employeeWithoutPassword);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'An error occurred updating the employee.' });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const empId = parseInt(id as string);

    if (isNaN(empId)) {
      res.status(400).json({ message: 'Invalid employee ID.' });
      return;
    }

    await prisma.user.delete({
      where: { id: empId },
    });

    res.status(200).json({ message: 'Employee deleted successfully.' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'An error occurred deleting the employee.' });
  }
};

export const getManagers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const managers = await prisma.user.findMany({
      where: {
        role: {
          in: ['MANAGER', 'ADMIN', 'HR'],
        },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });
    res.status(200).json(managers);
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ message: 'An error occurred fetching managers.' });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    if (parseInt(id as string) !== userId && role !== 'ADMIN' && role !== 'HR') {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded.' });
      return;
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id as string) },
      data: { avatar: avatarUrl },
      include: {
        department: { select: { name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const { password: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      message: 'Avatar uploaded successfully.',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'An error occurred uploading the avatar.' });
  }
};
