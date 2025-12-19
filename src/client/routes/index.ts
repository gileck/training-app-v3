import { Home } from './Home';
import { NotFound } from './NotFound';
import { AIChat } from './AIChat';
import { Settings } from './Settings';
import { Todos } from './Todos';
import { SingleTodo } from './SingleTodo';
import { createRoutes } from '../router';
import { Profile } from './Profile';
import { Reports } from './Reports';
// Define routes
export const routes = createRoutes({
  '/': Home,
  '/ai-chat': AIChat,
  '/todos': Todos,
  '/todos/:todoId': SingleTodo,
  '/settings': Settings,
  '/not-found': NotFound,
  '/profile': Profile,
  '/admin/reports': Reports,
});
