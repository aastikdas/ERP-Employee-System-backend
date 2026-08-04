import { PrismaClient, Role, Status, LeaveType, LeaveStatus, AttendanceStatus, PayrollStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed process...');

  // 0. Clear database in correct order of dependency
  console.log('Cleaning up existing database records...');
  await prisma.payroll.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.notification.deleteMany();
  
  // Clear department manager relationships first to avoid cyclic reference deletion issues
  await prisma.department.updateMany({
    data: { managerId: null }
  });
  
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  console.log('Generating password hashes...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Departments
  console.log('Creating departments...');
  const deptData = [
    { name: 'Engineering', code: 'ENG', description: 'Software development, engineering, and operations' },
    { name: 'Human Resources', code: 'HR', description: 'People operations, recruiting, culture, and compliance' },
    { name: 'Sales', code: 'SLS', description: 'Business development, client acquisition, and sales operations' },
    { name: 'Marketing', code: 'MKT', description: 'Brand management, campaign design, and product marketing' },
    { name: 'Finance', code: 'FIN', description: 'Financial planning, accounting, tax, and payroll services' },
  ];

  const depts: Record<string, any> = {};
  for (const d of deptData) {
    depts[d.name] = await prisma.department.create({ data: d });
  }

  // 2. Create System Admin
  console.log('Creating system admin...');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@erp.com',
      password: passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMIN,
      status: Status.ACTIVE,
      baseSalary: 125000,
      departmentId: depts['Human Resources'].id,
    },
  });

  // 3. Create HR Manager (who will process payrolls)
  console.log('Creating HR manager...');
  const hrManager = await prisma.user.create({
    data: {
      email: 'sarah.jenkins@erp.com',
      password: passwordHash,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      role: Role.HR,
      status: Status.ACTIVE,
      baseSalary: 88000,
      departmentId: depts['Human Resources'].id,
    },
  });

  // 4. Create Department Managers
  console.log('Creating department managers...');
  const managersData = [
    { email: 'john.doe@erp.com', firstName: 'John', lastName: 'Doe', dept: 'Engineering', salary: 110000 },
    { email: 'marcus.sales@erp.com', firstName: 'Marcus', lastName: 'Sales', dept: 'Sales', salary: 98000 },
    { email: 'olivia.martinez@erp.com', firstName: 'Olivia', lastName: 'Martinez', dept: 'Marketing', salary: 92000 },
    { email: 'emma.stone@erp.com', firstName: 'Emma', lastName: 'Stone', dept: 'Finance', salary: 102000 },
  ];

  const managers: Record<string, any> = {};
  for (const m of managersData) {
    managers[m.dept] = await prisma.user.create({
      data: {
        email: m.email,
        password: passwordHash,
        firstName: m.firstName,
        lastName: m.lastName,
        role: Role.MANAGER,
        status: Status.ACTIVE,
        baseSalary: m.salary,
        departmentId: depts[m.dept].id,
      }
    });
  }

  // 5. Link Departments to their Managers
  console.log('Linking departments to managers...');
  await prisma.department.update({ where: { id: depts['Engineering'].id }, data: { managerId: managers['Engineering'].id } });
  await prisma.department.update({ where: { id: depts['Human Resources'].id }, data: { managerId: hrManager.id } });
  await prisma.department.update({ where: { id: depts['Sales'].id }, data: { managerId: managers['Sales'].id } });
  await prisma.department.update({ where: { id: depts['Marketing'].id }, data: { managerId: managers['Marketing'].id } });
  await prisma.department.update({ where: { id: depts['Finance'].id }, data: { managerId: managers['Finance'].id } });

  // 6. Create 14 Employees
  console.log('Creating 14 employees...');
  const employeesData = [
    // Engineering (under John Doe)
    { email: 'alice.smith@erp.com', firstName: 'Alice', lastName: 'Smith', dept: 'Engineering', manager: 'Engineering', salary: 85000, phone: '+1 (555) 101-1001', address: '101 Pine St, Seattle, WA', dob: new Date('1992-04-12'), joining: new Date('2024-02-15') },
    { email: 'bob.johnson@erp.com', firstName: 'Bob', lastName: 'Johnson', dept: 'Engineering', manager: 'Engineering', salary: 92000, phone: '+1 (555) 101-1002', address: '204 Elm St, Seattle, WA', dob: new Date('1988-08-23'), joining: new Date('2023-06-10') },
    { email: 'charlie.brown@erp.com', firstName: 'Charlie', lastName: 'Brown', dept: 'Engineering', manager: 'Engineering', salary: 78000, phone: '+1 (555) 101-1003', address: '305 Oak Ave, Redmond, WA', dob: new Date('1995-11-30'), joining: new Date('2024-10-01') },
    { email: 'diana.prince@erp.com', firstName: 'Diana', lastName: 'Prince', dept: 'Engineering', manager: 'Engineering', salary: 105000, phone: '+1 (555) 101-1004', address: '777 Paradise Island, Seattle, WA', dob: new Date('1990-03-21'), joining: new Date('2022-04-18') },
    { email: 'evan.wright@erp.com', firstName: 'Evan', lastName: 'Wright', dept: 'Engineering', manager: 'Engineering', salary: 80000, phone: '+1 (555) 101-1005', address: '12 Maple Rd, Bellevue, WA', dob: new Date('1994-07-09'), joining: new Date('2025-01-10') },
    
    // Sales (under Marcus Sales)
    { email: 'fiona.gallagher@erp.com', firstName: 'Fiona', lastName: 'Gallagher', dept: 'Sales', manager: 'Sales', salary: 65000, phone: '+1 (555) 202-2001', address: '2113 Canary Ln, Chicago, IL', dob: new Date('1996-09-14'), joining: new Date('2024-05-12') },
    { email: 'george.clooney@erp.com', firstName: 'George', lastName: 'Clooney', dept: 'Sales', manager: 'Sales', salary: 75000, phone: '+1 (555) 202-2002', address: '45 Ocean Blvd, Los Angeles, CA', dob: new Date('1985-05-06'), joining: new Date('2023-01-20') },
    { email: 'hannah.montana@erp.com', firstName: 'Hannah', lastName: 'Montana', dept: 'Sales', manager: 'Sales', salary: 60000, phone: '+1 (555) 202-2003', address: '505 Malibu Way, Malibu, CA', dob: new Date('1998-11-23'), joining: new Date('2025-03-01') },
    { email: 'ian.mckellen@erp.com', firstName: 'Ian', lastName: 'McKellen', dept: 'Sales', manager: 'Sales', salary: 82000, phone: '+1 (555) 202-2004', address: '12 Shire Ln, London, UK', dob: new Date('1980-05-25'), joining: new Date('2022-09-15') },
    
    // Marketing (under Olivia Martinez)
    { email: 'julia.roberts@erp.com', firstName: 'Julia', lastName: 'Roberts', dept: 'Marketing', manager: 'Marketing', salary: 70000, phone: '+1 (555) 303-3001', address: '89 Georgia Ave, Atlanta, GA', dob: new Date('1987-10-28'), joining: new Date('2024-03-01') },
    { email: 'kevin.bacon@erp.com', firstName: 'Kevin', lastName: 'Bacon', dept: 'Marketing', manager: 'Marketing', salary: 68000, phone: '+1 (555) 303-3002', address: '6 Degrees Rd, Philadelphia, PA', dob: new Date('1989-07-08'), joining: new Date('2024-09-15') },
    
    // Finance (under Emma Stone)
    { email: 'laura.croft@erp.com', firstName: 'Laura', lastName: 'Croft', dept: 'Finance', manager: 'Finance', salary: 90000, phone: '+1 (555) 404-4001', address: '1 Croft Manor, Surrey, UK', dob: new Date('1993-02-14'), joining: new Date('2023-11-01') },
    { email: 'michael.scott@erp.com', firstName: 'Michael', lastName: 'Scott', dept: 'Finance', manager: 'Finance', salary: 95000, phone: '+1 (555) 404-4002', address: '1725 Slough Ave, Scranton, PA', dob: new Date('1984-03-15'), joining: new Date('2023-08-10') },
    
    // Human Resources (under Sarah Jenkins - hrManager)
    { email: 'grace.kelly@erp.com', firstName: 'Grace', lastName: 'Kelly', dept: 'Human Resources', manager: 'HR', salary: 62000, phone: '+1 (555) 505-5001', address: '3 Monaco Palace, Monaco', dob: new Date('1991-11-12'), joining: new Date('2024-11-05') },
  ];

  const employees: any[] = [];
  for (const emp of employeesData) {
    const managerId = emp.manager === 'HR' ? hrManager.id : managers[emp.manager].id;
    const created = await prisma.user.create({
      data: {
        email: emp.email,
        password: passwordHash,
        firstName: emp.firstName,
        lastName: emp.lastName,
        phone: emp.phone,
        address: emp.address,
        dob: emp.dob,
        dateOfJoining: emp.joining,
        role: Role.EMPLOYEE,
        status: Status.ACTIVE,
        baseSalary: emp.salary,
        departmentId: depts[emp.dept].id,
        managerId: managerId,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${emp.firstName}`,
      }
    });
    employees.push(created);
  }

  // 7. Seed Attendance Records for all 14 employees and the managers/HR manager
  console.log('Seeding attendance history (last 10 workdays)...');
  // Get last 10 workdays in UTC midnight
  const workdays: Date[] = [];
  let current = new Date();
  current.setUTCHours(0, 0, 0, 0);
  while (workdays.length < 10) {
    current.setUTCDate(current.getUTCDate() - 1);
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
      workdays.push(new Date(current));
    }
  }

  const allStaff = [...employees, ...Object.values(managers), hrManager];

  for (const staff of allStaff) {
    for (const date of workdays) {
      const rand = Math.random();
      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      let clockIn: Date;
      let clockOut: Date | null = null;
      let remarks = 'Clocked in on time';

      if (rand < 0.82) {
        // PRESENT
        status = AttendanceStatus.PRESENT;
        const checkInHour = 8;
        const checkInMin = 30 + Math.floor(Math.random() * 45); // 08:30 to 09:15
        clockIn = new Date(date);
        clockIn.setUTCHours(checkInHour, checkInMin, 0, 0);
        
        const checkOutHour = 17;
        const checkOutMin = Math.floor(Math.random() * 45); // 17:00 to 17:45
        clockOut = new Date(date);
        clockOut.setUTCHours(checkOutHour, checkOutMin, 0, 0);
        remarks = 'Clocked in on time';
      } else if (rand < 0.92) {
        // LATE
        status = AttendanceStatus.LATE;
        const checkInHour = 9 + Math.floor(Math.random() * 2); // 9 or 10
        const checkInMin = checkInHour === 9 ? 31 + Math.floor(Math.random() * 29) : Math.floor(Math.random() * 30); // 09:31 to 10:30
        clockIn = new Date(date);
        clockIn.setUTCHours(checkInHour, checkInMin, 0, 0);
        
        const checkOutHour = 17;
        const checkOutMin = Math.floor(Math.random() * 30); // 17:00 to 17:30
        clockOut = new Date(date);
        clockOut.setUTCHours(checkOutHour, checkOutMin, 0, 0);
        remarks = 'Clocked in late (after 09:30 AM)';
      } else if (rand < 0.96) {
        // HALF_DAY
        status = AttendanceStatus.HALF_DAY;
        const checkInHour = 8;
        const checkInMin = 30 + Math.floor(Math.random() * 30); // 08:30 to 09:00
        clockIn = new Date(date);
        clockIn.setUTCHours(checkInHour, checkInMin, 0, 0);
        
        clockOut = new Date(date);
        clockOut.setUTCHours(13, 0, 0, 0); // 13:00 clockOut
        remarks = 'Left early (half day)';
      } else {
        // ABSENT
        status = AttendanceStatus.ABSENT;
        clockIn = new Date(date);
        clockIn.setUTCHours(9, 0, 0, 0);
        clockOut = null;
        remarks = 'Absent without prior notice';
      }

      await prisma.attendance.create({
        data: {
          employeeId: staff.id,
          date: date,
          clockIn: clockIn,
          clockOut: clockOut,
          status: status,
          remarks: remarks,
        }
      });
    }
  }

  // 8. Seed Leave Requests
  console.log('Seeding leave requests (approved, pending, rejected)...');
  const leaveReasons = [
    { type: LeaveType.CASUAL, reason: 'Family vacation trip', duration: 4 },
    { type: LeaveType.SICK, reason: 'Dental surgery and recovery', duration: 2 },
    { type: LeaveType.EARNED, reason: 'Professional development boot camp', duration: 5 },
    { type: LeaveType.SICK, reason: 'Severe cold & fever', duration: 3 },
  ];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const leaveConfig1 = leaveReasons[i % leaveReasons.length];
    
    // Past Approved Leave
    const pastStart = new Date();
    pastStart.setDate(pastStart.getDate() - 25 - (i * 2));
    const pastEnd = new Date(pastStart);
    pastEnd.setDate(pastEnd.getDate() + leaveConfig1.duration - 1);
    
    await prisma.leave.create({
      data: {
        employeeId: emp.id,
        startDate: pastStart,
        endDate: pastEnd,
        type: leaveConfig1.type,
        status: LeaveStatus.APPROVED,
        reason: leaveConfig1.reason,
        approvedById: hrManager.id,
      }
    });

    // Future Leave
    if (i % 2 === 0) {
      const leaveConfig2 = leaveReasons[(i + 1) % leaveReasons.length];
      const futureStart = new Date();
      futureStart.setDate(futureStart.getDate() + 8 + i);
      const futureEnd = new Date(futureStart);
      futureEnd.setDate(futureEnd.getDate() + leaveConfig2.duration - 1);
      
      await prisma.leave.create({
        data: {
          employeeId: emp.id,
          startDate: futureStart,
          endDate: futureEnd,
          type: leaveConfig2.type,
          status: i % 4 === 0 ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
          reason: leaveConfig2.reason,
          approvedById: i % 4 === 0 ? hrManager.id : null,
        }
      });
    }
  }

  // 9. Seed Payroll History (June & July as PAID, August as PENDING)
  console.log('Seeding payroll historical logs...');
  const payrollMonths = [
    { month: 6, year: 2026, status: PayrollStatus.PAID, payDate: new Date('2026-06-30') },
    { month: 7, year: 2026, status: PayrollStatus.PAID, payDate: new Date('2026-07-31') },
    { month: 8, year: 2026, status: PayrollStatus.PENDING, payDate: null },
  ];

  for (const staff of allStaff) {
    for (const p of payrollMonths) {
      const allowances = Math.round(staff.baseSalary * 0.1 / 12); // 10% allowances
      const deductions = Math.round(staff.baseSalary * 0.05 / 12); // 5% deductions
      const monthlyBase = Math.round(staff.baseSalary / 12);
      const netSalary = monthlyBase + allowances - deductions;

      await prisma.payroll.create({
        data: {
          employeeId: staff.id,
          month: p.month,
          year: p.year,
          baseSalary: monthlyBase,
          allowances: allowances,
          deductions: deductions,
          netSalary: netSalary,
          status: p.status,
          paymentDate: p.payDate,
          processedById: hrManager.id,
        }
      });
    }
  }

  console.log('Database has been seeded successfully with:');
  console.log(' - 5 Departments');
  console.log(' - 1 Admin, 1 HR Manager, 4 Dept Managers');
  console.log(' - 14 Robust Employees');
  console.log(' - 10 Workdays of Attendance History per Employee');
  console.log(' - 25+ Leave Requests (Approved & Pending)');
  console.log(' - 3 Months of Payroll Records (June, July, August)');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
