export type { User, MicrosoftUser } from './model/types'
export {
  getMe,
  getUser,
  getUsers,
  setUserRole,
  setUserBlocked,
  setUserArchived,
  setTimeTrackingRole,
  patchMyWeeklyCapacityHours,
  setUserPosition,
  getMicrosoftUsers,
  uploadDesktopBackground,
  deleteDesktopBackground,
} from './api'
