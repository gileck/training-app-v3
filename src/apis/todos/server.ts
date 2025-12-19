// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_GET_TODOS, API_GET_TODO, API_CREATE_TODO, API_UPDATE_TODO, API_DELETE_TODO } from './index';

// Import handlers
import { getTodos } from './handlers/getTodos';
import { getTodo } from './handlers/getTodo';
import { createTodo } from './handlers/createTodo';
import { updateTodo } from './handlers/updateTodo';
import { deleteTodo } from './handlers/deleteTodo';

// Export consolidated handlers object
export const todosApiHandlers = {
    [API_GET_TODOS]: { process: getTodos },
    [API_GET_TODO]: { process: getTodo },
    [API_CREATE_TODO]: { process: createTodo },
    [API_UPDATE_TODO]: { process: updateTodo },
    [API_DELETE_TODO]: { process: deleteTodo }
}; 