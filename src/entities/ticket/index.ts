export type { Ticket, Comment, StatusItem, PriorityItem, TicketsParams } from './model/types'
export {
  getStatuses,
  getPriorities,
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  archiveTicket,
  getComments,
  addComment,
  updateComment,
  deleteComment,
} from './api'
export {
  listTicketsWs,
  listStatusesWs,
  listPrioritiesWs,
  getTicketWs,
  updateTicketWs,
  archiveTicketWs,
  listCommentsWs,
  addCommentWs,
  editCommentWs,
  deleteCommentWs,
  closeTicketsWs,
} from './ticketsWs'
