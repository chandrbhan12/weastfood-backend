import Notification from '../models/Notification.js';

// Get notifications for a user
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id;

    if (id === 'all') {
      await Notification.updateMany({ recipient: userId }, { isRead: true });
      return res.json({ success: true, message: 'All notifications marked as read' });
    }

    const notif = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });

    res.json(notif);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
