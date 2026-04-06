import express from 'express';
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  acceptRequest,
  rejectRequest,
  updateStatus,
  createPublicRequest,
  getHistory,
  getTopDonors,
  getTopDonatedFood,
  getDashboardStats,
  updateLocation,
  deleteRequest,
} from '../controllers/pickupController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Create a pickup request (donor)
router.post('/', protect, createRequest);
// Public endpoint to allow unauthenticated creation (useful for external posts/testing)
router.post('/public', createPublicRequest);

// Get my requests (as donor and as partner)
router.get('/me', protect, getMyRequests);

// Get donation history for donor
router.get('/history', protect, getHistory);

// Admin / listing
router.get('/', protect, getAllRequests);
// Public listing (no auth) so unauthenticated frontends can read listings
router.get('/public', getAllRequests);

// Top donors (public)
router.get('/top-donors', getTopDonors);
// Top donated food (public)
router.get('/top-donated-food', getTopDonatedFood);

// Dashboard stats
router.get('/stats', protect, getDashboardStats);

// Accept / reject
router.post('/:id/accept', protect, acceptRequest);
router.post('/:id/reject', protect, rejectRequest);

// Update status
router.post('/:id/status', protect, updateStatus);
// Delete
router.delete('/:id', protect, deleteRequest);
// Location update
router.patch('/:id/location', protect, updateLocation);

export default router;
