import type { Express, Request, Response } from "express";

import {
  MOCK_GROUP_MEMBERSHIP_ADMIN,
  MOCK_GROUP_MEMBERSHIP_DEV,
  ID_TO_GROUP_NAME,
} from "../constants.js";
import { validateBearerToken } from "../crypto.js";
import { getCustomUserGroups } from "./users.js";

export function registerGraphRoutes(app: Express): void {
  app.get(
    "/me/memberOf/microsoft.graph.group",
    (req: Request, res: Response) => {
      const decoded = validateBearerToken(req, res);
      if (!decoded) {
        return;
      }

      const userEmail = decoded.email;
      const customGroups = getCustomUserGroups(userEmail);
      if (customGroups) {
        const groupDetails = customGroups.map((id) => ({
          id,
          displayName: ID_TO_GROUP_NAME[id] || id,
        }));
        res.json({ value: groupDetails });
        return;
      }

      const userId = decoded.sub;
      const isDevUser = userId === "dev-uuid";

      res.json(
        isDevUser
          ? MOCK_GROUP_MEMBERSHIP_DEV
          : MOCK_GROUP_MEMBERSHIP_ADMIN
      );
    }
  );
}
