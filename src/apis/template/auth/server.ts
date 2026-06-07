import {
    changePassword,
    login,
    logout,
    me,
    register,
    requestPasswordReset,
    resetPassword,
    updateProfile,
    passkeyRegisterOptions,
    passkeyRegisterVerify,
    passkeyList,
    passkeyRename,
    passkeyDelete,
    passkeyLoginOptions,
    passkeyLoginVerify,
    passkeyEnrollOptions,
    passkeyEnrollVerify,
    passkeySignupOptions,
    passkeySignupVerify,
    passkeyStepUpOptions,
    passkeyStepUpVerify,
} from "./index";
import { getCurrentUser } from "./handlers/getCurrentUser";
import { loginUser } from "./handlers/loginUser";
import { logoutUser } from "./handlers/logoutUser";
import { registerUser } from "./handlers/registerUser";
import { updateUserProfile } from "./handlers/updateUserProfile";
import { changeUserPassword } from "./handlers/changePassword";
import { requestUserPasswordReset } from "./handlers/requestPasswordReset";
import { resetUserPassword } from "./handlers/resetPassword";
import { passkeyRegisterOptionsHandler } from "./handlers/passkey/registerOptions";
import { passkeyRegisterVerifyHandler } from "./handlers/passkey/registerVerify";
import { passkeyListHandler } from "./handlers/passkey/listPasskeys";
import { passkeyRenameHandler } from "./handlers/passkey/renamePasskey";
import { passkeyDeleteHandler } from "./handlers/passkey/deletePasskey";
import { passkeyLoginOptionsHandler } from "./handlers/passkey/loginOptions";
import { passkeyLoginVerifyHandler } from "./handlers/passkey/loginVerify";
import { passkeyEnrollOptionsHandler } from "./handlers/passkey/enrollOptions";
import { passkeyEnrollVerifyHandler } from "./handlers/passkey/enrollVerify";
import { passkeySignupOptionsHandler } from "./handlers/passkey/signupOptions";
import { passkeySignupVerifyHandler } from "./handlers/passkey/signupVerify";
import { passkeyStepUpOptionsHandler } from "./handlers/passkey/stepUpOptions";
import { passkeyStepUpVerifyHandler } from "./handlers/passkey/stepUpVerify";
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
    [passkeyRegisterOptions]: { process: passkeyRegisterOptionsHandler },
    [passkeyRegisterVerify]: { process: passkeyRegisterVerifyHandler },
    [passkeyList]: { process: passkeyListHandler },
    [passkeyRename]: { process: passkeyRenameHandler },
    [passkeyDelete]: { process: passkeyDeleteHandler },
    [passkeyLoginOptions]: { process: passkeyLoginOptionsHandler },
    [passkeyLoginVerify]: { process: passkeyLoginVerifyHandler },
    [passkeyEnrollOptions]: { process: passkeyEnrollOptionsHandler },
    [passkeyEnrollVerify]: { process: passkeyEnrollVerifyHandler },
    [passkeySignupOptions]: { process: passkeySignupOptionsHandler },
    [passkeySignupVerify]: { process: passkeySignupVerifyHandler },
    [passkeyStepUpOptions]: { process: passkeyStepUpOptionsHandler },
    [passkeyStepUpVerify]: { process: passkeyStepUpVerifyHandler },
};

