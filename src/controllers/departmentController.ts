import { Response } from 'express';
import { prisma } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getDepartments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.status(200).json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'An error occurred fetching departments.' });
  }
};

export const getDepartmentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deptId = parseInt(id as string);

    if (isNaN(deptId)) {
      res.status(400).json({ message: 'Invalid department ID.' });
      return;
    }

    const department = await prisma.department.findUnique({
      where: { id: deptId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!department) {
      res.status(404).json({ message: 'Department not found.' });
      return;
    }

    res.status(200).json(department);
  } catch (error) {
    console.error('Get department detail error:', error);
    res.status(500).json({ message: 'An error occurred fetching department details.' });
  }
};

export const createDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, managerId } = req.body;

    if (!name || !code) {
      res.status(400).json({ message: 'Department name and code are required.' });
      return;
    }

    const existingName = await prisma.department.findUnique({ where: { name } });
    if (existingName) {
      res.status(400).json({ message: 'A department with this name already exists.' });
      return;
    }

    const existingCode = await prisma.department.findUnique({ where: { code } });
    if (existingCode) {
      res.status(400).json({ message: 'A department with this code already exists.' });
      return;
    }

    let managerConnect: any = undefined;
    if (managerId) {
      const user = await prisma.user.findUnique({ where: { id: parseInt(managerId) } });
      if (!user) {
        res.status(404).json({ message: 'Selected manager not found.' });
        return;
      }
      managerConnect = parseInt(managerId);
    }

    const department = await prisma.department.create({
      data: {
        name,
        code,
        description,
        managerId: managerConnect,
      },
    });

    if (managerId) {
      await prisma.user.update({
        where: { id: parseInt(managerId) },
        data: { departmentId: department.id },
      });
    }

    res.status(201).json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ message: 'An error occurred creating the department.' });
  }
};

export const updateDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deptId = parseInt(id as string);

    if (isNaN(deptId)) {
      res.status(400).json({ message: 'Invalid department ID.' });
      return;
    }

    const { name, code, description, managerId } = req.body;

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (code) dataToUpdate.code = code;
    if (description !== undefined) dataToUpdate.description = description;
    if (managerId !== undefined) {
      dataToUpdate.managerId = managerId ? parseInt(managerId) : null;
    }

    const updatedDepartment = await prisma.department.update({
      where: { id: deptId },
      data: dataToUpdate,
    });

    if (managerId) {
      await prisma.user.update({
        where: { id: parseInt(managerId) },
        data: { departmentId: updatedDepartment.id },
      });
    }

    res.status(200).json(updatedDepartment);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ message: 'An error occurred updating the department.' });
  }
};

export const deleteDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deptId = parseInt(id as string);

    if (isNaN(deptId)) {
      res.status(400).json({ message: 'Invalid department ID.' });
      return;
    }

    await prisma.user.updateMany({
      where: { departmentId: deptId },
      data: { departmentId: null },
    });

    await prisma.department.delete({
      where: { id: deptId },
    });

    res.status(200).json({ message: 'Department deleted successfully.' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ message: 'An error occurred deleting the department.' });
  }
};
