import { Response } from 'express';
import { prisma } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'An error occurred fetching notifications.' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const notif = await prisma.notification.findUnique({
      where: { id: parseInt(id as string) },
    });

    if (!notif) {
      res.status(404).json({ message: 'Notification not found.' });
      return;
    }

    if (notif.userId !== userId) {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id: parseInt(id as string) },
      data: { isRead: true },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'An error occurred marking notification as read.' });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: 'An error occurred marking all notifications as read.' });
  }
};
