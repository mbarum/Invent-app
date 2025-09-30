import 'express-session';
import { User } from '@masuma-ea/types';

// Augment the 'express-session' module to add the 'user' property to the SessionData interface
declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}

// Augment the global Express namespace to add the 'user' property to the Request interface
// This is for our authMiddleware to attach the user to the request object itself (req.user)
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Ensure this file is treated as a module.
export {};
