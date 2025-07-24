import { Router } from 'express';
import { SupportTicketController } from '../controllers/support-ticket.controller';
import { SupportMessageController } from '../controllers/support-message.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { AdminRole } from '../types/admin.types';

const router = Router();

// Ticket routes
router.get(
    '/tickets/list',
    authMiddleware,
    SupportTicketController.getTickets
);

router.post(
    '/tickets/create',
    authMiddleware,
    SupportTicketController.createTicket
);

router.put(
    '/tickets/:id',
    authMiddleware,
    SupportTicketController.updateTicket
);

router.delete(
    '/tickets/:id',
    authMiddleware,
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    SupportTicketController.deleteTicket
);

// Message routes
router.get(
    '/messages',
    authMiddleware,
    SupportMessageController.getMessages
);

router.post(
    '/messages/create',
    authMiddleware,
    SupportMessageController.createMessage
);

router.put(
    '/messages/:id',
    authMiddleware,
    SupportMessageController.updateMessage
);

router.delete(
    '/messages/:id',
    authMiddleware,
    roleGuard([AdminRole.SUPER_ADMIN, AdminRole.ADMIN]),
    SupportMessageController.deleteMessage
);

router.put(
    '/messages/mark-read/:ticket_id',
    authMiddleware,
    SupportMessageController.markAsRead
);

export default router; 