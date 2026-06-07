type Entitlements = {
  maxMessagesPerDay: number;
};

export type UserType = "regular";

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 9999,
  },
};
