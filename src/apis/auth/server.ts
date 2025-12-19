import { login, logout, me, register, updateProfile } from "./index";
import { getCurrentUser } from "./handlers/getCurrentUser";
import { loginUser } from "./handlers/loginUser";
import { logoutUser } from "./handlers/logoutUser";
import { registerUser } from "./handlers/registerUser";
import { updateUserProfile } from "./handlers/updateUserProfile";
export * from "./shared";

// Export API endpoint names and types from index.ts as per guidelines
export * from './index';

export const authApiHandlers = {
    [login]: { process: loginUser },
    [register]: { process: registerUser },
    [me]: { process: getCurrentUser },
    [logout]: { process: logoutUser },
    [updateProfile]: { process: updateUserProfile },
};

