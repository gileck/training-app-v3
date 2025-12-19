# Module System

* All code must use ES modules (import/export) for both client and server.
* Never use export default, always use named exports.

# Function Design

* Avoid general options parameters. 
* Always pass explicit parameters to functions for clarity and maintainability.
* Each function should perform one logical task, and the function name should clearly reflect its purpose.

# Code Organization

* Separate server-side code and client-side code in different folders and keep a clear separation between them.
* When needing to share logic between client and server, always move the shared logic to a shared folder without external dependencies.
* Never import server-side code to client-side code and vice versa.
* Keep the files relatively small when possible. 
* When files are getting too big - split them into smaller files with logical separation of concerns.
* Avoid using switch case, instead use object mapping. 
* Avoid large functions - split them into smaller functions with a single responsibility.

# Logical Separation of Concerns

* Keep UI, state management, and business logic separate.
* Business logic should be in pure functions and should not directly manipulate UI state.
* State management should not contain API calls—instead, separate API interactions into services or repositories.
* Avoid deeply nested dependencies between modules to keep code maintainable and testable.

# Prefer simplicity over optimizations 

* Avoid unnecessary abstractions or complex patterns when a simple solution would work just as well.
* If I did not ask to imrpove performance, do not implement any optimizations and keep the code simple.

# Unused variables
* Never leave unused variables in the code. Always remove them. double check that you did not miss any.

# ES LINT
* Never disable eslint without asking for permission