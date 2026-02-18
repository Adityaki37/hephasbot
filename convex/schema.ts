import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        tokenIdentifier: v.string(),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
    }).index("by_token", ["tokenIdentifier"]),

    robot_profiles: defineTable({
        userId: v.string(),
        name: v.string(),
        calibrationLimits: v.array(v.object({
            min: v.number(),
            max: v.number()
        })),
        lastUpdated: v.number(),
    })
        .index("by_user", ["userId"])
        .index("by_user_name", ["userId", "name"]),
});
