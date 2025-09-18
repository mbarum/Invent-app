import { User } from '@masuma-ea/types';
import 'express-session';

declare global {
    namespace Express {
        interface Request {
            user?: User; 
        }
        interface SessionData {
            user?: User;
        }
    }
}
