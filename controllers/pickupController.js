import PickupRequest from '../models/PickupRequest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import crypto from 'crypto';


// Create a new pickup request (by donor / restaurant)
export const createRequest = async (req, res) => {
  try {
    const { items, location, scheduledAt, notes, image, servings, type } = req.body;
    const donorId = req.user?.id;

    if (!donorId) return res.status(401).json({ message: 'Unauthorized' });
    if (!items) return res.status(400).json({ message: 'Items description required' });

    const reqDoc = await PickupRequest.create({
      donor: donorId,
      items,
      image,
      servings,
      type,
      location,
      scheduledAt,
      notes,
    });

    // increment donor points (10 points per donation)
    try {
      await User.findByIdAndUpdate(donorId, { $inc: { points: 10 } });
    } catch (e) {
      console.warn('Failed to increment donor points', e);
    }

    // populate donor for richer payload
    await reqDoc.populate('donor pickupPartner');

    // Create notifications for all NGOs and Volunteers
    try {
      const ngoAndVolunteers = await User.find({ role: { $in: ['ngo', 'volunteer'] } });
      ngoAndVolunteers.forEach(recipient => {
        Notification.create({
          recipient: recipient._id,
          sender: donorId,
          title: 'New Food Post!',
          message: `${items} is now available for pickup at ${location}.`,
          type: 'new_food'
        }).catch(err => console.error('Notif error', err));
      });
    } catch (err) {
      console.warn('Failed to create post notifications', err);
    }

    res.status(201).json(reqDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public create endpoint for external posts (no auth required)
export const createPublicRequest = async (req, res) => {
  try {
    const { items, location, scheduledAt, notes, image, servings, type, donorName, donorEmail, donorAvatar } = req.body;

    if (!items) return res.status(400).json({ message: 'Items description required' });

    let donorId = null;
    // If an email is provided, try to find existing user
    if (donorEmail) {
      const existing = await User.findOne({ email: donorEmail.toLowerCase() });
      if (existing) donorId = existing._id;
    }

    // If no donorId found, create a lightweight donor user (restaurant role)
    if (!donorId) {
      const tempEmail = donorEmail ? donorEmail.toLowerCase() : `public_${crypto.randomBytes(6).toString('hex')}@local.public`;
      const tempPassword = crypto.randomBytes(8).toString('hex');
      const newUser = new User({
        full_name: donorName || 'Public Donor',
        email: tempEmail,
        password: tempPassword,
        role: 'restaurant',
        avatar_url: donorAvatar || null,
      });
      await newUser.save();
      donorId = newUser._id;
    }

    const reqDoc = await PickupRequest.create({
      donor: donorId,
      items,
      image,
      servings,
      type,
      location,
      scheduledAt,
      notes,
    });

    // increment donor points (10 points per donation)
    try {
      await User.findByIdAndUpdate(donorId, { $inc: { points: 10 } });
    } catch (e) {
      console.warn('Failed to increment donor points', e);
    }

    // populate donor for richer payload
    await reqDoc.populate('donor pickupPartner');

    // Create notifications for all NGOs and Volunteers
    try {
      const ngoAndVolunteers = await User.find({ role: { $in: ['ngo', 'volunteer'] } });
      ngoAndVolunteers.forEach(recipient => {
        Notification.create({
          recipient: recipient._id,
          sender: donorId,
          title: 'New Public Food Post!',
          message: `${items} is available for pickup at ${location}.`,
          type: 'new_food'
        }).catch(err => console.error('Notif error', err));
      });
    } catch (err) {
      console.warn('Failed to create public post notifications', err);
    }

    res.status(201).json(reqDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get requests for current user (donor or pickup partner)
export const getMyRequests = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const asDonor = await PickupRequest.find({ donor: userId }).populate('pickupPartner donor');
    const asPartner = await PickupRequest.find({ pickupPartner: userId }).populate('pickupPartner donor');

    res.json({ asDonor, asPartner });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all requests (admin / for listing)
export const getAllRequests = async (req, res) => {
  try {
    const list = await PickupRequest.find().populate('pickupPartner donor').sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Accept request (by pickup partner)
export const acceptRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const reqDoc = await PickupRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ message: 'Request not found' });

    reqDoc.status = 'accepted';
    reqDoc.pickupPartner = userId;
    await reqDoc.save();

    // populate for richer payload
    await reqDoc.populate('pickupPartner donor');

    // Create notification for the donor
    try {
      await Notification.create({
        recipient: reqDoc.donor._id,
        sender: userId,
        title: 'Food Claimed!',
        message: `Your donation for "${reqDoc.items}" has been accepted and is being processed.`,
        type: 'claimed'
      });
    } catch (err) {
      console.warn('Failed to create claim notification', err);
    }

    res.json(reqDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reject request
export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const reqDoc = await PickupRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ message: 'Request not found' });

    reqDoc.status = 'rejected';
    await reqDoc.save();

    await reqDoc.populate('pickupPartner donor');

    res.json(reqDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update status (generic)
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const reqDoc = await PickupRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ message: 'Request not found' });

    reqDoc.status = status;
    await reqDoc.save();

    await reqDoc.populate('pickupPartner donor');

    res.json(reqDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get donation history for a donor
export const getHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const history = await PickupRequest.find({ donor: userId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get top donors by points
// Get dashboard stats for NGO / Volunteer
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nearbyRequests = await PickupRequest.countDocuments({ status: 'requested' });
    const totalToday = await PickupRequest.countDocuments({ createdAt: { $gte: today } });
    const activePickups = await PickupRequest.countDocuments({ 
      pickupPartner: userId, 
      status: { $in: ['accepted', 'in_transit'] } 
    });
    const completedDeliveries = await PickupRequest.countDocuments({ 
      pickupPartner: userId, 
      status: 'completed' 
    });

    res.json({
      nearbyRequests,
      totalToday,
      activePickups,
      completedDeliveries,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getTopDonors = async (req, res) => {
  try {
    const top = await User.find({}).sort({ points: -1 }).limit(5).select('full_name points avatar_url');
    res.json(top);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get top donated food (aggregated by item name)
export const getTopDonatedFood = async (req, res) => {
  try {
    const top = await PickupRequest.aggregate([
      {
        $group: {
          _id: { $toLower: "$items" },
          original_name: { $first: "$items" },
          count: { $sum: 1 },
          image: { $first: "$image" },
          points: { $sum: 10 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]);
    res.json(top.map(t => ({
      name: t.original_name,
      points: t.points,
      image: t.image,
      count: t.count
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update volunteer live location
export const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    const userId = req.user?.id;

    const reqDoc = await PickupRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ message: 'Request not found' });

    // Only assigned pickup partner or admin can update location
    if (reqDoc.pickupPartner?.toString() !== userId) {
      return res.status(403).json({ message: 'Only assigned partner can update location' });
    }

    reqDoc.currentLat = lat;
    reqDoc.currentLng = lng;
    reqDoc.lastLocationUpdate = new Date();
    await reqDoc.save();

    res.json({ success: true, lat, lng });
  } catch (error) {
    console.error('Update location error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a donation request
export const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const reqDoc = await PickupRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ message: 'Request not found' });

    // Only original donor can delete
    if (reqDoc.donor.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized: Only the creator can delete this post' });
    }

    await reqDoc.deleteOne();
    res.json({ success: true, message: 'Donation deleted successfully' });
  } catch (error) {
    console.error('Delete request error', error);
    res.status(500).json({ message: 'Server error' });
  }
};
