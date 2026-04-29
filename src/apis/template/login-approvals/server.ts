export * from './index';

import { COMPLETE_LOGIN_APPROVAL } from './index';
import { completeLoginApproval } from './handlers/completeLoginApproval';

export const loginApprovalsApiHandlers = {
  [COMPLETE_LOGIN_APPROVAL]: { process: completeLoginApproval },
};
