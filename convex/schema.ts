import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        tokenIdentifier: v.string(), // WorkOS User ID
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        profileImage: v.optional(v.string()),
    }).index("by_token", ["tokenIdentifier"]),

    robots: defineTable({
        userId: v.id("users"),
        name: v.string(),
        model: v.string(), // e.g. "so-100"
        status: v.string(), // "online" | "offline" | "busy"
        lastConnected: v.number(),
        config: v.optional(v.any()), // flexible config for different robots
    }).index("by_user", ["userId"]),
});
