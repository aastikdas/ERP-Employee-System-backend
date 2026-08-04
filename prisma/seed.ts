import { PrismaClient, Role, Status } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clear database in correct order of dependency
  await prisma.payroll.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leave.deleteMany();
  
  // Clear department manager relationships first to avoid cyclic reference deletion issues
  await prisma.department.updateMany({
    data: { managerId: null }
  });
  
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  const passwordHash = await bcrypt.hash('admin123', 10);
  const managerPasswordHash = await bcrypt.hash('manager123', 10);
  const hrPasswordHash = await bcrypt.hash('hr123', 10);
  const employeePasswordHash = await bcrypt.hash('employee123', 10);

  // 1. Create Departments
  const engineering = await prisma.department.create({
    data: {
      name: 'Engineering',
      code: 'ENG',
      description: 'Software development and operations',
    },
  });

  const hrDept = await prisma.department.create({
    data: {
      name: 'Human Resources',
      code: 'HR',
      description: 'People operations and hiring',
    },
  });

  const sales = await prisma.department.create({
    data: {
      name: 'Sales',
      code: 'SLS',
      description: 'Customer acquisition and revenue',
    },
  });

  // 2. Create Users
  // Admin
  await prisma.user.create({
    data: {
      email: 'admin@erp.com',
      password: passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMIN,
      status: Status.ACTIVE,
      baseSalary: 120000,
      departmentId: hrDept.id,
    },
  });

  // HR Manager
  const hr = await prisma.user.create({
    data: {
      email: 'hr@erp.com',
      password: hrPasswordHash,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      role: Role.HR,
      status: Status.ACTIVE,
      baseSalary: 85000,
      departmentId: hrDept.id,
    },
  });

  // Manager
  const manager = await prisma.user.create({
    data: {
      email: 'manager@erp.com',
      password: managerPasswordHash,
      firstName: 'John',
      lastName: 'Doe',
      role: Role.MANAGER,
      status: Status.ACTIVE,
      baseSalary: 95000,
      departmentId: engineering.id,
    },
  });

  // Update Engineering Department with Manager
  await prisma.department.update({
    where: { id: engineering.id },
    data: { managerId: manager.id },
  });

  // Update HR Department with HR Manager
  await prisma.department.update({
    where: { id: hrDept.id },
    data: { managerId: hr.id },
  });

  // Employee 1 (under manager john doe)
  await prisma.user.create({
    data: {
      email: 'employee1@erp.com',
      password: employeePasswordHash,
      firstName: 'Alice',
      lastName: 'Smith',
      role: Role.EMPLOYEE,
      status: Status.ACTIVE,
      baseSalary: 65000,
      departmentId: engineering.id,
      managerId: manager.id,
    },
  });

  // Employee 2 (under manager john doe)
  await prisma.user.create({
    data: {
      email: 'employee2@erp.com',
      password: employeePasswordHash,
      firstName: 'Bob',
      lastName: 'Johnson',
      role: Role.EMPLOYEE,
      status: Status.ACTIVE,
      baseSalary: 70000,
      departmentId: engineering.id,
      managerId: manager.id,
    },
  });

  console.log('Database has been seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
