export const GROUP_MEMBER_ACTION_TIMEOUT_MS = 10000;

export class GroupMemberActionTimeoutError extends Error {
  constructor() {
    super("group member action timed out");
    this.name = "GroupMemberActionTimeoutError";
    this.code = "timeout";
  }
}

/**
 * Firestore writes wait for a server acknowledgement and can remain pending
 * while the connection is unstable. Keep the member sheet responsive even if
 * that acknowledgement does not arrive; the original write may still settle
 * later, so its rejection is always observed.
 */
export function waitForGroupMemberAction(
  action,
  timeoutMs = GROUP_MEMBER_ACTION_TIMEOUT_MS,
) {
  const work = Promise.resolve().then(action);
  work.catch(() => {});

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new GroupMemberActionTimeoutError()), timeoutMs);
  });

  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
