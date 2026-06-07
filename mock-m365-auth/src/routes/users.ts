import type { Express, Request, Response } from "express";
import { GROUP_NAME_TO_ID, ID_TO_GROUP_NAME } from "../constants.js";

const customUsers = new Map<string, string[]>();

export function registerUserRoutes(app: Express): void {
  app.post("/api/users", (req: Request, res: Response) => {
    const { email, groups } = req.body;

    if (!email || !Array.isArray(groups) || groups.length === 0) {
      res.status(400).json({ message: "Email and at least one group required" });
      return;
    }

    const validGroupNames = Object.keys(GROUP_NAME_TO_ID);
    const invalidGroups = groups.filter((g) => !validGroupNames.includes(g));

    if (invalidGroups.length > 0) {
      res.status(400).json({ message: `Invalid groups: ${invalidGroups.join(", ")}` });
      return;
    }

    const groupIds = groups.map((name) => GROUP_NAME_TO_ID[name]);
    customUsers.set(email, groupIds);
    res.status(201).json({ message: "User created", email, groups: groupIds });
  });

  app.get("/api/users/:email", (req: Request, res: Response) => {
    const emailParam = req.params.email;
    const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;
    const groups = customUsers.get(email);
    if (!groups) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const groupDetails = groups.map((id) => ({
      id,
      displayName: ID_TO_GROUP_NAME[id] || id,
    }));
    res.json({ value: groupDetails });
  });
}

export function getCustomUserGroups(email: string): string[] | undefined {
  return customUsers.get(email);
}
