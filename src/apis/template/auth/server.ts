import { changePassword, login, logout, me, register, requestPasswordReset, resetPassword, updateProfile } from "./index";
import { getCurrentUser } from "./handlers/getCurrentUser";
import { loginUser } from "./handlers/loginUser";
import { logoutUser } from "./handlers/logoutUser";
import { registerUser } from "./handlers/registerUser";
import { updateUserProfile } from "./handlers/updateUserProfile";
import { changeUserPassword } from "./handlers/changePassword";
import { requestUserPasswordReset } from "./handlers/requestPasswordReset";
import { resetUserPassword } from "./handlers/resetPassword";
export * from "./shared";

// Export API endpoint names and types from index.ts as per guidelines
export * from './index';

export const authApiHandlers = {
    [login]: { process: loginUser },
    [register]: { process: registerUser },
    [me]: { process: getCurrentUser },
    [logout]: { process: logoutUser },
    [updateProfile]: { process: updateUserProfile },
    [changePassword]: { process: changeUserPassword },
    [requestPasswordReset]: { process: requestUserPasswordReset },
    [resetPassword]: { process: resetUserPassword },
};

