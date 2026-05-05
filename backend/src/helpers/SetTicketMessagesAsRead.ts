import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import { whatsappProvider } from "../providers/WhatsApp";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await Message.update(
    { read: true },
    {
      where: {
        ticketId: ticket.id,
        read: false
      }
    }
  );

  await ticket.update({ unreadMessages: 0 });

  try {
    if (ticket.whatsappId) {
      const digits = (ticket.contact.number || "").replace(/\D/g, "");
      const fallbackChatId = `${digits}@${ticket.isGroup ? "g" : "c"}.us`;

      const resolvedChatId = ticket.isGroup
        ? ""
        : await whatsappProvider.checkNumber(ticket.whatsappId, digits);

      await whatsappProvider.sendSeen(
        ticket.whatsappId,
        resolvedChatId || fallbackChatId
      );
    }
  } catch (err) {
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
  }

  const io = getIO();
  io.to(ticket.status).to("notification").emit("ticket", {
    action: "updateUnread",
    ticketId: ticket.id
  });
};

export default SetTicketMessagesAsRead;
