import { prisma } from './db';

export const createNotification = async (userId: number, title: string, message: string): Promise<void> => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
